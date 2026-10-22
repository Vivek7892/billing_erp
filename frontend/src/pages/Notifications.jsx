import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { ROLES } from '../constants'
import toast from 'react-hot-toast'
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowUpRight,
  IconBell,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconCreditCard,
  IconExternalLink,
  IconEye,
  IconFileText,
  IconFilter,
  IconInfoCircle,
  IconLayersLinked,
  IconDotsVertical,
  IconPackage,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconShieldExclamation,
  IconShoppingBag,
  IconTrash,
  IconTruck,
  IconUserCheck,
  IconX,
  IconCircleX,
} from '@tabler/icons-react'
import api from '../api'
import './Notifications.css'

// ─── Notification Types Configuration ──────────────────────────────────────

const TYPE_CONFIG = {
  low_stock:              { label: 'Low Stock',         icon: IconPackage,       badgeClass: 'badge-low-stock',  category: 'inventory' },
  invoice_overdue:        { label: 'Invoice Overdue',   icon: IconFileText,      badgeClass: 'badge-overdue',    category: 'sales_finance' },
  payment_received:       { label: 'Payment Received',  icon: IconCreditCard,    badgeClass: 'badge-paid',       category: 'sales_finance' },
  purchase_order_pending: { label: 'PO Pending',        icon: IconShoppingBag,   badgeClass: 'badge-pending',    category: 'sales_finance' },
  quotation_expiring:     { label: 'Quotation Expiring',icon: IconLayersLinked,        badgeClass: 'badge-pending',    category: 'sales_finance' },
  batch_expiring:         { label: 'Batch Expiring',    icon: IconAlertTriangle, badgeClass: 'badge-overdue',    category: 'inventory' },
  gst_submission_failed:  { label: 'GST Filing Alert',  icon: IconShieldExclamation,   badgeClass: 'badge-overdue',    category: 'compliance' },
  einvoice_failed:        { label: 'E-Invoice Error',   icon: IconAlertCircle,   badgeClass: 'badge-overdue',    category: 'compliance' },
  eway_bill_expiring:     { label: 'E-Way Bill',        icon: IconTruck,         badgeClass: 'badge-pending',    category: 'compliance' },
  approval_required:      { label: 'Approval Required', icon: IconUserCheck,     badgeClass: 'badge-active',     category: 'approvals' },
}

// ─── Severity Styles ───────────────────────────────────────────────────────

const SEVERITY_STYLE = {
  danger: {
    dot: '#EF4444',
    bg: '#FEF2F2',
    border: '#FECACA',
    color: '#B91C1C',
    icon: IconAlertCircle,
    label: 'Critical',
  },
  warning: {
    dot: '#F59E0B',
    bg: '#FFFBEB',
    border: '#FDE68A',
    color: '#B45309',
    icon: IconAlertTriangle,
    label: 'Warning',
  },
  success: {
    dot: '#10B981',
    bg: '#F0FDF4',
    border: '#BBF7D0',
    color: '#15803D',
    icon: IconCircleCheck,
    label: 'Success',
  },
  info: {
    dot: '#3B82F6',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    color: '#1D4ED8',
    icon: IconInfoCircle,
    label: 'Info',
  },
}

// ─── Formatting Helpers ────────────────────────────────────────────────────

function formatINR(val) {
  if (val === null || val === undefined || val === '') return ''
  const num = Number(val)
  if (isNaN(num)) return String(val)
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function relativeTime(isoString) {
  if (!isoString) return ''
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function getDateBucket(isoString) {
  if (!isoString) return 'EARLIER'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return 'EARLIER'
  const now = new Date()

  if (d.toDateString() === now.toDateString()) {
    return 'TODAY'
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) {
    return 'YESTERDAY'
  }

  return 'EARLIER'
}

// ─── Side-by-side Diff Viewer ──────────────────────────────────────────────

function DiffViewer({ currentData, proposedData }) {
  if (!currentData && !proposedData) return null

  const fmt = (val, key) => {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'number') {
      const k = (key || '').toLowerCase()
      if (k.includes('price') || k.includes('amount') || k.includes('total') || k.includes('limit') || k.includes('balance')) {
        return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
      return val.toString()
    }
    if (typeof val === 'object') {
      if (Array.isArray(val)) {
        return `${val.length} item(s) selected`
      }
      return JSON.stringify(val)
    }
    return String(val)
  }

  const currentEntries = Object.entries(currentData || {})
  const proposedEntries = Object.entries(proposedData || {}).filter(([k]) => k !== 'other_fields')

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2.5">
      {/* Current Data Snapshot */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] p-2.5">
        <div className="flex items-center justify-between pb-1 border-b border-[var(--line)] mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Current Data</span>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Live DB</span>
        </div>
        <div className="space-y-1 text-xs">
          {currentEntries.length === 0 ? (
            <span className="text-[11px] text-[var(--muted)] italic">No previous state</span>
          ) : (
            currentEntries.map(([k, v]) => (
              <div key={k} className="flex justify-between items-center text-[11px] gap-2">
                <span className="text-[var(--muted)] capitalize truncate">{k.replace(/_/g, ' ')}:</span>
                <span className="font-mono font-medium text-[var(--ink)] truncate">{fmt(v, k)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Proposed Changes Diff */}
      <div className="rounded-lg border border-teal-200 dark:border-teal-800/60 bg-teal-50/50 dark:bg-teal-950/20 p-2.5">
        <div className="flex items-center justify-between pb-1 border-b border-teal-200 dark:border-teal-800/60 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">Proposed Changes</span>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">New Value</span>
        </div>
        <div className="space-y-1 text-xs">
          {proposedEntries.length === 0 ? (
            <span className="text-[11px] text-[var(--muted)] italic">No changes specified</span>
          ) : (
            proposedEntries.map(([k, v]) => (
              <div key={k} className="flex justify-between items-center text-[11px] gap-2">
                <span className="text-teal-950 dark:text-teal-200 capitalize truncate">{k.replace(/_/g, ' ')}:</span>
                <span className="font-mono font-bold text-teal-700 dark:text-teal-300 truncate">{fmt(v, k)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Routing & Action Resolvers ────────────────────────────────────────────

function getNotificationRoute(item) {
  const type = item.notification_type
  const refId = item.reference_id
  const data = item.data || {}

  // If specific approval request: route to relevant domain entity if needed
  if (type === 'approval_required') {
    const reqType = data.request_type
    if (reqType === 'price_change') {
      const q = data.current_data?.name || data.current_data?.sku || ''
      return `/inventory/products${q ? `?search=${encodeURIComponent(q)}` : ''}`
    }
    if (reqType === 'refund') {
      return '/sales/returns'
    }
    if (reqType === 'stock_adjustment') {
      const q = data.current_data?.sku || ''
      return `/inventory/stock${q ? `?search=${encodeURIComponent(q)}` : ''}`
    }
    if (reqType === 'invoice_cancellation') {
      const q = data.current_data?.invoice_number || ''
      return `/sales/invoices${q ? `?search=${encodeURIComponent(q)}` : ''}`
    }
    if (reqType === 'user_role_change') {
      return '/users'
    }
    if (reqType === 'credit_limit_increase') {
      const q = data.current_data?.name || ''
      return `/parties/customers${q ? `?search=${encodeURIComponent(q)}` : ''}`
    }
    return '/notifications?tab=approvals'
  }

  switch (type) {
    case 'low_stock':
      return `/inventory/stock?search=${encodeURIComponent(data.sku || data.product_name || data.product_id || refId || '')}`
    case 'batch_expiring':
      return `/inventory/stock?search=${encodeURIComponent(data.batch_number || data.sku || data.product_name || '')}`
    case 'invoice_overdue':
      return `/sales/invoices?search=${encodeURIComponent(data.invoice_number || refId || '')}`
    case 'payment_received':
      return `/sales/payments${data.invoice_number ? `?search=${encodeURIComponent(data.invoice_number)}` : ''}`
    case 'purchase_order_pending': {
      const poVal = data.po_number || data.purchase_id || refId || ''
      return `/inventory/purchases${poVal ? `?po=${encodeURIComponent(poVal)}` : ''}`
    }
    case 'quotation_expiring':
      return `/sales/invoices?search=${encodeURIComponent(data.quotation_number || data.invoice_number || '')}`
    case 'gst_submission_failed':
    case 'einvoice_failed':
    case 'eway_bill_expiring':
      return '/reports'
    default:
      if (item.action_url) return item.action_url
      if (item.category === 'inventory') return '/inventory/stock'
      if (item.category === 'sales_finance') return refId ? `/invoice/${refId}` : '/sales/invoices'
      return null
  }
}

function getNotificationActionLabel(item) {
  if (item.requires_approval && item.status === 'active') return 'Review Request'
  if (item.notification_type === 'purchase_order_pending') return 'Review PO'
  if (item.action_label) return item.action_label
  switch (item.notification_type) {
    case 'low_stock': return 'Review Inventory'
    case 'batch_expiring': return 'Check Batch'
    case 'invoice_overdue': return 'View Invoice'
    case 'payment_received': return 'View Payment'
    case 'purchase_order_pending': return 'Review PO'
    case 'quotation_expiring': return 'Open Invoice'
    case 'gst_submission_failed':
    case 'einvoice_failed':
    case 'eway_bill_expiring': return 'Review Report'
    default: return 'Open'
  }
}

// ─── Context Strip ─────────────────────────────────────────────────────────

function NotificationContextStrip({ item }) {
  const data = item.data || {}
  const type = item.notification_type

  switch (type) {
    case 'invoice_overdue': {
      const invNum = data.invoice_number || item.reference_id
      const amount = data.amount || data.balance_due || data.grand_total
      const days = data.days_overdue
      return (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
          {invNum && (
            <span className="font-mono font-semibold text-[var(--ink)] bg-[var(--surface-elevated)] border border-[var(--line)] px-1.5 py-0.2 rounded text-[11px]">
              #{invNum}
            </span>
          )}
          {amount !== undefined && (
            <span className="font-semibold text-rose-700 dark:text-rose-400">
              {formatINR(amount)}
            </span>
          )}
          {days !== undefined && (
            <span className="text-amber-700 dark:text-amber-400 font-medium">
              · Overdue by {days} day{days === 1 ? '' : 's'}
            </span>
          )}
        </div>
      )
    }

    case 'low_stock': {
      const sku = data.sku
      const curr = data.current_stock
      const min = data.minimum_stock
      const isOut = Number(curr) <= 0
      return (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
          {sku && (
            <span className="font-mono font-semibold text-[var(--ink)] bg-[var(--surface-elevated)] border border-[var(--line)] px-1.5 py-0.2 rounded text-[11px]">
              SKU: {sku}
            </span>
          )}
          {curr !== undefined && (
            <span className={isOut ? 'font-bold text-rose-600 dark:text-rose-400' : 'font-semibold text-amber-700 dark:text-amber-400'}>
              Stock: {curr}
            </span>
          )}
          {min !== undefined && (
            <span className="text-[var(--muted)]">
              · Min: {min}
            </span>
          )}
        </div>
      )
    }

    case 'approval_required': {
      const requester = data.requested_by
      const rule = data.threshold_rule
      const currData = data.current_data || {}
      const propData = data.proposed_data || {}
      return (
        <div className="mt-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {requester && (
              <span className="text-[var(--muted)]">
                Requested by: <strong className="text-[var(--ink)] font-semibold">{requester}</strong>
              </span>
            )}
            {rule && (
              <span className="inline-block text-[10px] font-semibold px-2 py-0.2 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                {rule}
              </span>
            )}
          </div>
          {(currData.selling_price !== undefined || propData.selling_price !== undefined) && (
            <div className="text-xs font-mono flex items-center gap-1.5 text-teal-800 dark:text-teal-300">
              <span>Current: {formatINR(currData.selling_price)}</span>
              <span className="text-[var(--muted)]">→</span>
              <strong className="text-teal-700 dark:text-teal-400 font-bold">Proposed: {formatINR(propData.selling_price)}</strong>
            </div>
          )}
          {data.refund_amount !== undefined && (
            <div className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              Refund Amount: {formatINR(data.refund_amount)}
            </div>
          )}
        </div>
      )
    }

    case 'payment_received': {
      const amt = data.amount
      const method = data.method
      const inv = data.invoice_number
      return (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
          {amt !== undefined && (
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              {formatINR(amt)}
            </span>
          )}
          {method && (
            <span className="uppercase text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {method}
            </span>
          )}
          {inv && (
            <span className="text-[var(--muted)]">
              for #{inv}
            </span>
          )}
        </div>
      )
    }

    case 'purchase_order_pending': {
      const po = data.po_number || data.purchase_id
      const supplier = data.supplier_name
      const total = data.total_amount
      return (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
          {po && (
            <span className="font-mono font-semibold text-[var(--ink)] bg-[var(--surface-elevated)] border border-[var(--line)] px-1.5 py-0.2 rounded text-[11px]">
              PO #{po}
            </span>
          )}
          {supplier && (
            <span className="text-[var(--ink)]">
              {supplier}
            </span>
          )}
          {total !== undefined && (
            <span className="font-semibold text-teal-700 dark:text-teal-400">
              · {formatINR(total)}
            </span>
          )}
        </div>
      )
    }

    case 'batch_expiring': {
      const batch = data.batch_number
      const expiry = data.expiry_date
      const days = data.days_to_expiry
      return (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
          {batch && (
            <span className="font-mono font-semibold text-[var(--ink)] bg-[var(--surface-elevated)] border border-[var(--line)] px-1.5 py-0.2 rounded text-[11px]">
              Batch: {batch}
            </span>
          )}
          {expiry && (
            <span className="text-rose-700 dark:text-rose-400 font-medium">
              Expires: {expiry} {days !== undefined ? `(${days}d)` : ''}
            </span>
          )}
        </div>
      )
    }

    default:
      return null
  }
}

// ─── Clickable Summary Metric Card ─────────────────────────────────────────

function ActionMetricCard({ label, count, sub, active, onClick }) {
  return (
    <button
      type="button"
      className={`notification-kpi${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="notification-kpi-label">{label}</span>
      <strong>{count}</strong>
      <span className="notification-kpi-sub">{sub}</span>
    </button>
  )
}

// ─── Main Notifications Component ──────────────────────────────────────────

export default function Notifications() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManageApprovals = [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER].includes(user?.role) || user?.is_superuser
  const isAdminOrOwner = [ROLES.OWNER, ROLES.ADMIN].includes(user?.role) || user?.is_superuser

  // Data & State
  const [notifications, setNotifications] = useState([])
  const [counts, setCounts] = useState({ unread: 0, critical: 0, pending_approval: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastScanTime, setLastScanTime] = useState(new Date())

  // Tabs & Filters (default tab: "needs_attention")
  const [activeTab, setActiveTab] = useState('needs_attention')
  const [scopeFilter, setScopeFilter] = useState('role') // 'role' | 'all'
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')

  // Modals & Drawers
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false)
  const [approvalModal, setApprovalModal] = useState(null)
  const [approvalNotes, setApprovalNotes] = useState('')
  const [detailModal, setDetailModal] = useState(null)
  const [actioningId, setActioningId] = useState(null)
  const [dismissingId, setDismissingId] = useState(null)
  const [activeMenuId, setActiveMenuId] = useState(null)

  const searchInputRef = useRef(null)

  // ─── Keyboard shortcut Ctrl+K / Cmd+K ───────────────────────────────────
  useEffect(() => {
    const handleKeyDown = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Escape') {
        setActiveMenuId(null)
        if (detailModal) setDetailModal(null)
        if (approvalModal) setApprovalModal(null)
        if (quickDrawerOpen) setQuickDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [detailModal, approvalModal, quickDrawerOpen])

  // Close ... menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null)
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  // ─── Data Fetching (Role-Scoped or Full Business) ─────────────────────────

  const fetchNotifications = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setRefreshing(true)
      const res = await api.get(`/notifications/?scope=${scopeFilter === 'role' ? 'my_role' : 'all'}`)
      const notifs = res.data.notifications || []
      setNotifications(notifs)
      setCounts({
        unread: res.data.unread_count ?? notifs.filter(n => !n.is_read).length,
        critical: res.data.critical_count ?? notifs.filter(n => n.severity === 'danger').length,
        pending_approval: res.data.pending_approval_count ?? notifs.filter(n => n.requires_approval && n.status === 'active').length,
      })
      setLastScanTime(new Date())
      return notifs
    } catch {
      toast.error('Failed to load notifications')
      return []
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [scopeFilter])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // ─── Scan & Refresh ──────────────────────────────────────────────────────

  const handleRunChecks = async () => {
    try {
      setRefreshing(true)
      const prevIds = new Set(notifications.map(n => n.id))
      await api.post('/notifications/run-checks/')
      const updated = await fetchNotifications(true)
      const newItems = updated.filter(n => !prevIds.has(n.id))

      if (newItems.length > 0) {
        toast.success(`Scan completed · ${newItems.length} new alert${newItems.length === 1 ? '' : 's'} detected`)
      } else {
        toast.success('Scan completed · System alerts up to date')
      }
    } catch {
      toast.error('Failed to trigger notification scan')
      setRefreshing(false)
    }
  }

  // ─── Mark Single as Read ─────────────────────────────────────────────────

  const handleMarkRead = async id => {
    try {
      await api.post(`/notifications/${id}/read/`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setCounts(c => ({ ...c, unread: Math.max(0, c.unread - 1) }))
      if (detailModal?.id === id) {
        setDetailModal(prev => prev ? { ...prev, is_read: true } : null)
      }
      toast.success('Marked as read')
    } catch {
      toast.error('Could not update notification')
    }
  }

  // ─── Mark All as Read ────────────────────────────────────────────────────

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all/')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setCounts(c => ({ ...c, unread: 0 }))
      toast.success('All notifications marked as read')
    } catch {
      toast.error('Could not mark all as read')
    }
  }

  // ─── Dismiss Notification ────────────────────────────────────────────────

  const handleDismiss = async id => {
    try {
      setDismissingId(id)
      await api.post(`/notifications/${id}/read/`)
      setNotifications(prev => prev.filter(n => n.id !== id))
      setCounts(c => ({ ...c, unread: Math.max(0, c.unread - 1) }))
      if (detailModal?.id === id) setDetailModal(null)
      toast.success('Notification dismissed')
    } catch {
      toast.error('Could not dismiss notification')
    } finally {
      setDismissingId(null)
    }
  }

  // ─── Settings Button Click (Access Denied for Non-Admins) ─────────────────

  const handleSettingsClick = () => {
    if (!isAdminOrOwner) {
      toast.error('Access Denied: Only Administrators can configure notification & approval settings.', {
        icon: '🔒',
        duration: 4000,
      })
      return
    }
    navigate('/settings?tab=approvals')
  }

  // ─── Review & Approval Click Handler ─────────────────────────────────────

  const handleReviewClick = item => {
    if (!item.is_read) handleMarkRead(item.id)

    if (canManageApprovals) {
      setApprovalNotes('')
      setApprovalModal({
        id: item.id,
        title: item.title,
        message: item.message,
        type: item.status === 'active' ? 'approve' : 'view',
        data: item.data,
      })
    } else {
      toast.error('Access Denied: Manager or Administrator sign-off required for this approval.', {
        icon: '🔒',
        duration: 4000,
      })
      // Open in view-only mode so the cashier can still review the details
      setApprovalModal({
        id: item.id,
        title: item.title,
        message: item.message,
        type: 'view',
        data: item.data,
      })
    }
  }

  // ─── Approval / Rejection Action ─────────────────────────────────────────

  const handleApprovalAction = async (id, action) => {
    if (!canManageApprovals) {
      toast.error('Access Denied: Only Managers and Administrators can authorize approvals.', {
        icon: '🔒',
        duration: 4000,
      })
      return
    }

    try {
      setActioningId(id)
      const res = await api.post(`/notifications/${id}/action/`, { action, notes: approvalNotes })
      setNotifications(prev =>
        prev.map(n => n.id === id ? {
          ...n,
          status: res.data?.notification_status || (action === 'approve' ? 'approved' : 'rejected'),
          is_read: true,
          actioned_by_name: res.data?.actioned_by || user?.username,
          actioned_at: res.data?.actioned_at || new Date().toISOString(),
          action_notes: approvalNotes.trim(),
        } : n)
      )
      if (notifications.find(n => n.id === id)?.status === 'active') {
        setCounts(c => ({ ...c, pending_approval: Math.max(0, c.pending_approval - 1) }))
      }
      setApprovalModal(null)
      setApprovalNotes('')
      if (detailModal?.id === id) {
        setDetailModal(prev => prev ? {
          ...prev,
          status: res.data?.notification_status || (action === 'approve' ? 'approved' : 'rejected'),
          action_notes: approvalNotes.trim(),
          actioned_by_name: user?.username,
        } : null)
      }
      toast.success(action === 'approve' ? 'Approval & execution recorded' : 'Request authorization rejected')
    } catch (err) {
      toast.error(err?.response?.data?.error || `Failed to ${action}`)
    } finally {
      setActioningId(null)
    }
  }

  // ─── Direct One-Click Inline Approval / Rejection ─────────────────────────

  const handleDirectApproval = async (item, action) => {
    if (!canManageApprovals) {
      toast.error('Access Denied: Manager or Administrator sign-off required for this approval.', {
        icon: '🔒',
        duration: 4000,
      })
      return
    }

    try {
      setActioningId(item.id)
      const notes = action === 'approve' ? 'Directly approved via notification list' : 'Directly rejected via notification list'
      const res = await api.post(`/notifications/${item.id}/action/`, { action, notes })
      setNotifications(prev =>
        prev.map(n => n.id === item.id ? {
          ...n,
          status: res.data?.notification_status || (action === 'approve' ? 'approved' : 'rejected'),
          is_read: true,
          actioned_by_name: res.data?.actioned_by || user?.username,
          actioned_at: res.data?.actioned_at || new Date().toISOString(),
          action_notes: notes,
        } : n)
      )
      if (item.status === 'active') {
        setCounts(c => ({ ...c, pending_approval: Math.max(0, c.pending_approval - 1) }))
      }
      toast.success(action === 'approve' ? 'Request Approved & Executed' : 'Request Rejected')
    } catch (err) {
      toast.error(err?.response?.data?.error || `Failed to ${action}`)
    } finally {
      setActioningId(null)
    }
  }

  // ─── Primary Navigation ──────────────────────────────────────────────────

  const handleNavigateNotification = item => {
    if (!item.is_read) handleMarkRead(item.id)

    // Approvals: directly trigger the Review & Approval modal
    if (item.requires_approval && item.status === 'active') {
      handleReviewClick(item)
      return
    }

    const targetRoute = getNotificationRoute(item)
    if (targetRoute) {
      navigate(targetRoute)
    } else {
      setDetailModal(item)
    }
  }

  // ─── Filtered Notifications ──────────────────────────────────────────────

  const filteredNotifications = useMemo(() => {
    const now = Date.now()
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTodayMs = startOfToday.getTime()

    return notifications.filter(item => {
      // 1. Tab filter
      if (activeTab === 'needs_attention') {
        const isUrgent = item.severity === 'danger' || item.severity === 'warning'
        const isApproval = item.requires_approval && item.status === 'active'
        const isActiveState = item.status === 'active'
        if (!(isUrgent || isApproval || (isActiveState && !item.is_read))) return false
      } else if (activeTab === 'unread') {
        if (item.is_read) return false
      } else if (activeTab === 'critical') {
        if (item.severity !== 'danger') return false
      } else if (activeTab === 'approvals') {
        if (!item.requires_approval) return false
      } else if (['inventory', 'sales_finance', 'compliance'].includes(activeTab)) {
        if (TYPE_CONFIG[item.notification_type]?.category !== activeTab) return false
      }

      // 2. Type filter
      if (typeFilter && item.notification_type !== typeFilter) return false

      // 3. Severity filter
      if (severityFilter !== 'all' && item.severity !== severityFilter) return false

      // 4. Status filter
      if (statusFilter === 'unread' && item.is_read) return false
      if (statusFilter === 'read' && !item.is_read) return false
      if (statusFilter === 'active' && item.status !== 'active') return false
      if (statusFilter === 'resolved' && !['approved', 'rejected', 'completed'].includes(item.status)) return false

      // 5. Time filter
      if (timeFilter !== 'all' && item.created_at) {
        const itemTime = new Date(item.created_at).getTime()
        if (timeFilter === 'today' && itemTime < startOfTodayMs) return false
        if (timeFilter === '7days' && itemTime < now - 7 * 86400000) return false
        if (timeFilter === '30days' && itemTime < now - 30 * 86400000) return false
        if (timeFilter === 'older' && itemTime >= now - 30 * 86400000) return false
      }

      // 6. Search query
      if (search.trim()) {
        const q = search.toLowerCase()
        const dataStr = item.data ? JSON.stringify(item.data).toLowerCase() : ''
        const typeLabel = TYPE_CONFIG[item.notification_type]?.label?.toLowerCase() || ''
        const matchesTitle = item.title?.toLowerCase().includes(q)
        const matchesMessage = item.message?.toLowerCase().includes(q)
        const matchesType = typeLabel.includes(q) || item.notification_type?.toLowerCase().includes(q)
        const matchesRef = item.reference_id?.toLowerCase()?.includes(q)
        const matchesData = dataStr.includes(q)
        if (!matchesTitle && !matchesMessage && !matchesType && !matchesRef && !matchesData) return false
      }

      return true
    })
  }, [notifications, activeTab, typeFilter, severityFilter, statusFilter, timeFilter, search])

  // ─── Date Grouping ───────────────────────────────────────────────────────

  const groupedNotifications = useMemo(() => {
    const groups = {
      TODAY: [],
      YESTERDAY: [],
      EARLIER: [],
    }

    filteredNotifications.forEach(item => {
      const bucket = getDateBucket(item.created_at)
      if (groups[bucket]) groups[bucket].push(item)
      else groups.EARLIER.push(item)
    })

    return groups
  }, [filteredNotifications])

  // ─── Metric Aggregations ─────────────────────────────────────────────────

  const criticalCount = useMemo(
    () => notifications.filter(n => n.severity === 'danger').length,
    [notifications]
  )

  const warningCount = useMemo(
    () => notifications.filter(n => n.severity === 'warning').length,
    [notifications]
  )

  const needsActionCount = useMemo(
    () => notifications.filter(n =>
      (n.severity === 'danger' || n.severity === 'warning' || n.requires_approval) &&
      n.status === 'active'
    ).length,
    [notifications]
  )

  const pendingApprovalCount = useMemo(
    () => notifications.filter(n => n.requires_approval && n.status === 'active').length,
    [notifications]
  )

  // ─── Active Filter Chips ─────────────────────────────────────────────────

  const activeChips = useMemo(() => {
    const chips = []
    if (search.trim()) {
      chips.push({ id: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') })
    }
    if (typeFilter) {
      chips.push({
        id: 'type',
        label: TYPE_CONFIG[typeFilter]?.label || typeFilter,
        onRemove: () => setTypeFilter(''),
      })
    }
    if (severityFilter !== 'all') {
      chips.push({
        id: 'severity',
        label: `Severity: ${SEVERITY_STYLE[severityFilter]?.label || severityFilter}`,
        onRemove: () => setSeverityFilter('all'),
      })
    }
    if (statusFilter !== 'all') {
      chips.push({
        id: 'status',
        label: `Status: ${statusFilter}`,
        onRemove: () => setStatusFilter('all'),
      })
    }
    if (timeFilter !== 'all') {
      const timeLabels = { today: 'Today', '7days': 'Last 7 days', '30days': 'Last 30 days', older: 'Older' }
      chips.push({
        id: 'time',
        label: `Time: ${timeLabels[timeFilter] || timeFilter}`,
        onRemove: () => setTimeFilter('all'),
      })
    }
    return chips
  }, [search, typeFilter, severityFilter, statusFilter, timeFilter])

  const handleClearAllFilters = () => {
    setSearch('')
    setTypeFilter('')
    setSeverityFilter('all')
    setStatusFilter('all')
    setTimeFilter('all')
    setActiveTab('needs_attention')
  }

  // ─── Tabs List ───────────────────────────────────────────────────────────

  const tabList = [
    { key: 'needs_attention', label: 'Needs Attention', count: needsActionCount },
    { key: 'all',             label: 'All',             count: notifications.length },
    { key: 'unread',          label: 'Unread',          count: counts.unread },
    { key: 'critical',        label: 'Critical',        count: criticalCount },
    { key: 'approvals',       label: 'Approvals',       count: pendingApprovalCount },
    { key: 'inventory',       label: 'Stock & Batches' },
    { key: 'sales_finance',   label: 'Sales & Finance' },
    { key: 'compliance',      label: 'GST & Compliance' },
  ]

  // ─── Incident Rollup Summary (Section 12) ────────────────────────────────

  const lowStockRollup = useMemo(() => {
    const list = notifications.filter(n => n.notification_type === 'low_stock' && n.status === 'active')
    if (list.length >= 2) {
      const outOfStock = list.filter(n => n.severity === 'danger').length
      return {
        count: list.length,
        outOfStock,
        label: `${list.length} products below minimum stock threshold ${outOfStock > 0 ? `(${outOfStock} out of stock)` : ''}`,
        route: '/inventory/stock',
      }
    }
    return null
  }, [notifications])

  const overdueInvoicesRollup = useMemo(() => {
    const list = notifications.filter(n => n.notification_type === 'invoice_overdue' && n.status === 'active')
    if (list.length >= 2) {
      const totalOverdue = list.reduce((sum, it) => sum + (Number(it.data?.amount || it.data?.balance_due || 0)), 0)
      return {
        count: list.length,
        totalOverdue,
        label: `${list.length} invoices overdue for collection ${totalOverdue > 0 ? `· Total: ${formatINR(totalOverdue)}` : ''}`,
        route: '/sales/invoices',
      }
    }
    return null
  }, [notifications])

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="notifications-page min-w-0 space-y-3 sm:space-y-4 pb-8">

      {/* ── 1. Header (Mobile-Friendly & Action-Oriented) ── */}
      <header className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            {/* Bell Icon: Tap to toggle slide-over drawer on desktop and mobile */}
            <button
              type="button"
              onClick={() => setQuickDrawerOpen(v => !v)}
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--primary)] border border-blue-200/60 dark:bg-blue-950/40 dark:border-blue-900/40 active:scale-95 transition"
              title="Open Notifications Drawer"
              aria-label="Open notification drawer"
            >
              <IconBell size={18} className="text-[var(--primary)] sm:w-5 sm:h-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="truncate text-base sm:text-xl font-bold text-[var(--ink)]">
                  Notifications
                </h1>
                {needsActionCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.2 sm:px-2 sm:py-0.5 text-[9px] sm:text-[10px] font-bold">
                    {needsActionCount} urgent
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] sm:text-xs text-[var(--ink-secondary)] truncate">
                {needsActionCount === 0 ? (
                  <span>All caught up · Operational queues healthy</span>
                ) : (
                  <span><strong>{needsActionCount} items</strong> need attention</span>
                )}
                <span className="mx-1 text-[var(--muted)]">·</span>
                <span className="text-[10px] sm:text-[11px] text-[var(--muted)]">
                  {criticalCount} Critical · {warningCount} Warnings · {pendingApprovalCount} Approvals
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 sm:shrink-0">
            {/* Scan timestamp indicator */}
            <div className="hidden lg:flex items-center gap-1 text-[11px] text-[var(--muted)] font-mono mr-1">
              <IconClock size={11} />
              <span>Last scanned {relativeTime(lastScanTime) || 'just now'}</span>
            </div>

            {/* Scan & Refresh Button (lower button size on mobile) */}
            <button
              type="button"
              onClick={handleRunChecks}
              disabled={refreshing}
              className="btn-secondary inline-flex h-8 sm:h-9 items-center justify-center gap-1 rounded-lg px-2 sm:px-3 text-[11px] sm:text-xs font-semibold shadow-none transition"
              title="Trigger real-time alert scanner"
            >
              <IconRefresh size={12} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden xs:inline">Scan &amp; Refresh</span>
              <span className="xs:hidden">Scan</span>
            </button>

            {/* Mark All Read Button */}
            {counts.unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="btn-secondary inline-flex h-8 sm:h-9 items-center justify-center gap-1 rounded-lg px-2 sm:px-3 text-[11px] sm:text-xs font-semibold shadow-none transition"
                title="Mark all notifications as read"
              >
                <IconCheck size={12} />
                <span className="hidden xs:inline">Mark All Read</span>
                <span className="xs:hidden">Read All</span>
              </button>
            )}

            {/* Notification Settings (Shows Access Denied for Cashiers) */}
            <button
              type="button"
              onClick={handleSettingsClick}
              className="btn-secondary inline-flex h-8 sm:h-9 items-center justify-center gap-1 rounded-lg px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold shadow-none transition"
              title={isAdminOrOwner ? "Notification & Approval Rules Settings" : "Admin access required"}
              aria-label="Notification Settings"
            >
              <IconSettings size={13} />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Role Scope & Context Banner ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3 sm:px-4 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] text-xs shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="inline-flex items-center gap-1.5 font-bold text-[var(--ink)]">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span>Role Queue:</span>
            <span className="capitalize px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold">
              {user?.role || 'Staff'}
            </span>
          </span>
          <span className="text-[var(--muted)] hidden md:inline">·</span>
          <span className="text-[11px] text-[var(--muted)] hidden md:inline">
            {user?.role === 'cashier'
              ? 'Showing counter payments, stock alerts, and your submitted approval requests.'
              : user?.role === 'manager'
              ? 'Showing operational stock, purchase orders, quotations, and authorization queues.'
              : user?.role === 'accountant'
              ? 'Showing overdue invoices, payments received, and tax/compliance reports.'
              : 'Showing all operational queues, compliance alerts, and administrator authorizations.'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          <span className="text-[10px] text-[var(--muted)] font-semibold">Scope:</span>
          <button
            type="button"
            onClick={() => setScopeFilter('role')}
            className={`h-6 px-2 rounded-md text-[11px] font-semibold transition ${
              scopeFilter === 'role'
                ? 'bg-[var(--primary)] text-white shadow-2xs'
                : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]'
            }`}
          >
            My Role
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('all')}
            className={`h-6 px-2 rounded-md text-[11px] font-semibold transition ${
              scopeFilter === 'all'
                ? 'bg-[var(--primary)] text-white shadow-2xs'
                : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]'
            }`}
          >
            All Alerts
          </button>
        </div>
      </div>

      {/* ── 2. Clickable Summary Cards ── */}
      <section className="notification-kpi-grid grid grid-cols-2 gap-2 sm:gap-2.5 sm:grid-cols-4" aria-label="Notification summary">
        <ActionMetricCard
          label="Critical"
          count={criticalCount}
          sub="Immediate attention"
          active={activeTab === 'critical'}
          onClick={() => setActiveTab('critical')}
        />
        <ActionMetricCard
          label="Needs Action"
          count={needsActionCount}
          sub="Open items"
          active={activeTab === 'needs_attention'}
          onClick={() => setActiveTab('needs_attention')}
        />
        <ActionMetricCard
          label="Pending Approvals"
          count={pendingApprovalCount}
          sub="Awaiting sign-off"
          active={activeTab === 'approvals'}
          onClick={() => setActiveTab('approvals')}
        />
        <ActionMetricCard
          label="Unread"
          count={counts.unread}
          sub="Not reviewed"
          active={activeTab === 'unread'}
          onClick={() => setActiveTab('unread')}
        />
      </section>

      {/* ── 3. Grouped Incident Rollups ── */}
      {(lowStockRollup || overdueInvoicesRollup) && (
        <div className="space-y-1.5 sm:space-y-2">
          {lowStockRollup && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-center gap-1.5 min-w-0">
                <IconPackage size={14} className="text-amber-600 shrink-0" />
                <span className="font-semibold truncate">{lowStockRollup.label}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate(lowStockRollup.route)}
                className="shrink-0 text-[11px] sm:text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline inline-flex items-center gap-1 ml-2"
              >
                <span>Inventory</span>
                <IconArrowUpRight size={11} />
              </button>
            </div>
          )}
          {overdueInvoicesRollup && (
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/80 px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              <div className="flex items-center gap-1.5 min-w-0">
                <IconFileText size={14} className="text-red-600 shrink-0" />
                <span className="font-semibold truncate">{overdueInvoicesRollup.label}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate(overdueInvoicesRollup.route)}
                className="shrink-0 text-[11px] sm:text-xs font-bold text-red-800 dark:text-red-300 hover:underline inline-flex items-center gap-1 ml-2"
              >
                <span>Invoices</span>
                <IconArrowUpRight size={11} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 4. Tabs & Filter Toolbar ── */}
      <section className="notifications-filter-panel space-y-2 sm:space-y-2.5">
        {/* Primary Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--line)] pb-1.5 scrollbar-none">
          {tabList.map(tab => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--primary)] text-white shadow-2xs'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.2 text-[9px] sm:text-[10px] font-mono ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--ink)]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Toolbar: Search & Select Dropdowns */}
        <div className="notifications-filter-bar flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Search Box with Ctrl+K */}
          <div className="notifications-search group relative flex items-center h-8 sm:h-9 flex-1 min-w-[180px] max-w-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600 focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15 shadow-2xs">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted)] group-focus-within:text-[var(--primary)]">
              <IconSearch size={13} strokeWidth={2.2} />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="w-full bg-transparent px-1.5 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--placeholder)] outline-none"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
                title="Clear search"
                aria-label="Clear search"
              >
                <IconX size={11} strokeWidth={2.5} />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex shrink-0 items-center rounded border border-[var(--line)] bg-[var(--surface-elevated)] px-1 py-0.2 text-[9px] font-semibold text-[var(--muted)] shadow-2xs">
                Ctrl+K
              </kbd>
            )}
          </div>

          <button
            type="button"
            className="notifications-filter-toggle md:hidden"
            onClick={() => setShowFilters(open => !open)}
            aria-expanded={showFilters}
            aria-controls="notifications-advanced-filters"
          >
            <IconFilter size={13} />
            <span>{showFilters ? 'Hide filters' : 'Filters'}</span>
            {activeChips.length > 0 && <span className="notification-filter-count">{activeChips.length}</span>}
          </button>

          {/* Type Filter */}
          <div id="notifications-advanced-filters" className={`notifications-advanced-filters${showFilters ? ' is-open' : ''}`}>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="h-8 sm:h-9 px-2 text-[11px] sm:text-xs rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] shadow-2xs"
            aria-label="Filter by notification type"
          >
            <option value="">All Types</option>
            {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
              <option key={k} value={k}>{cfg.label}</option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="h-8 sm:h-9 px-2 text-[11px] sm:text-xs rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] shadow-2xs"
            aria-label="Filter by severity"
          >
            <option value="all">All Severities</option>
            <option value="danger">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-8 sm:h-9 px-2 text-[11px] sm:text-xs rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] shadow-2xs"
            aria-label="Filter by read/action status"
          >
            <option value="all">All Statuses</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </select>

          {/* Time Filter */}
          <select
            value={timeFilter}
            onChange={e => setTimeFilter(e.target.value)}
            className="h-8 sm:h-9 px-2 text-[11px] sm:text-xs rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] shadow-2xs"
            aria-label="Filter by time range"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="older">Older</option>
          </select>
          </div>

          <span className="text-[10px] sm:text-[11px] text-[var(--muted)] ml-auto font-mono">
            {filteredNotifications.length} shown
          </span>
        </div>

        {/* Active Filter Chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] sm:text-[11px] font-semibold text-[var(--muted)] flex items-center gap-1 mr-1">
              <IconFilter size={10} /> Filters:
            </span>
            {activeChips.map(chip => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-[var(--ink)]"
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="text-[var(--muted)] hover:text-red-500 rounded-full"
                  aria-label={`Remove filter ${chip.label}`}
                >
                  <IconX size={10} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-[10px] sm:text-[11px] font-semibold text-[var(--primary)] hover:underline ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      {/* ── 5. Notification List (Grouped by Date) ── */}
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        {loading ? (
          <div className="p-10 text-center">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              <IconRefresh size={14} className="animate-spin text-[var(--primary)]" />
              Loading operational notification queues...
            </div>
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="divide-y divide-[var(--line)]">
            {['TODAY', 'YESTERDAY', 'EARLIER'].map(bucket => {
              const items = groupedNotifications[bucket]
              if (!items || items.length === 0) return null

              return (
                <div key={bucket} className="date-group-section">
                  {/* Date Group Header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    <span className="flex items-center gap-1.5">
                      <IconClock size={10} />
                      <span>{bucket}</span>
                    </span>
                    <span className="font-mono text-[9px]">{items.length} alert{items.length === 1 ? '' : 's'}</span>
                  </div>

                  {/* Desktop Work Queue Table (hidden md:block) */}
                  <div className="hidden overflow-x-auto">
                    <table className="table w-full notifications-table">
                      <thead>
                        <tr className="border-b border-[var(--line-subtle)] text-[11px] font-semibold text-[var(--muted)]">
                          <th className="w-3 p-0"></th>
                          <th className="w-8 text-center py-2">·</th>
                          <th className="w-24 py-2">Severity</th>
                          <th className="w-32 py-2">Category</th>
                          <th className="py-2">Operational Alert Details</th>
                          <th className="w-32 py-2">Time</th>
                          <th className="w-32 py-2 text-center">Action</th>
                          <th className="w-10 py-2 text-right pr-3">More</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line-subtle)]">
                        {items.map(item => {
                          const cfg = TYPE_CONFIG[item.notification_type] || { label: item.notification_type, icon: IconBell, badgeClass: 'status-neutral' }
                          const sev = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE.info
                          const TypeIcon = cfg.icon
                          const SevIcon = sev.icon
                          const actionLabel = getNotificationActionLabel(item)
                          const isApproval = item.requires_approval
                          const isMenuOpen = activeMenuId === item.id

                          return (
                            <tr
                              key={item.id}
                              className={`group transition-colors relative ${
                                !item.is_read
                                  ? 'bg-blue-50/25 dark:bg-blue-950/20 font-medium'
                                  : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
                              }`}
                            >
                              {/* Unread Status Dot */}
                              <td className="text-center py-2.5">
                                <span
                                  style={item.is_read ? {} : { background: sev.dot }}
                                  className={`inline-block h-2 w-2 rounded-full ${
                                    item.is_read ? 'bg-[var(--line-strong)] opacity-25' : 'ring-2 ring-white dark:ring-slate-900'
                                  }`}
                                  title={item.is_read ? 'Read notification' : 'Unread alert'}
                                />
                              </td>

                              {/* Severity Badge */}
                              <td className="py-2.5 whitespace-nowrap">
                                <span
                                  style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                                >
                                  <SevIcon size={10} />
                                  <span>{sev.label}</span>
                                </span>
                              </td>

                              {/* Type Badge */}
                              <td className="py-2.5 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badgeClass}`}>
                                  <TypeIcon size={10} />
                                  <span>{cfg.label}</span>
                                </span>
                              </td>

                              {/* Alert Details: Title, Message & Context */}
                              <td className="py-2.5 pr-4 max-w-md">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-[var(--ink)] leading-snug">
                                    {item.title}
                                  </span>
                                  {isApproval && (
                                    <span className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full ${
                                      item.status === 'approved' ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300' :
                                      item.status === 'rejected' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                                      'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    }`}>
                                      {item.status === 'active' ? 'APPROVAL REQUIRED' : item.status}
                                      {item.actioned_by_name ? ` · ${item.actioned_by_name}` : ''}
                                    </span>
                                  )}
                                </div>

                                <p className="mt-0.5 text-xs text-[var(--ink-secondary)] leading-relaxed line-clamp-2">
                                  {item.message}
                                </p>

                                <NotificationContextStrip item={item} />
                              </td>

                              {/* Timestamp */}
                              <td className="py-2.5 whitespace-nowrap">
                                <div className="text-xs font-mono text-[var(--ink)]">{formatTime(item.created_at)}</div>
                                <div className="text-[10px] text-[var(--muted)] font-mono mt-0.5">{relativeTime(item.created_at)}</div>
                              </td>

                              {/* Primary Action Button (Compact with Inline Approve / Reject for Approvals) */}
                              <td className="py-2.5 text-center whitespace-nowrap">
                                {isApproval && item.status === 'active' ? (
                                  <div className="inline-flex items-center gap-1.5 justify-center">
                                    {canManageApprovals ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleDirectApproval(item, 'approve')}
                                          disabled={actioningId === item.id}
                                          className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 text-[11px] font-semibold shadow-2xs transition"
                                          title="Authorize & execute request"
                                        >
                                          <IconCircleCheck size={11} />
                                          <span>{actioningId === item.id ? '…' : 'Approve'}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDirectApproval(item, 'reject')}
                                          disabled={actioningId === item.id}
                                          className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 text-[11px] font-semibold shadow-2xs transition"
                                          title="Reject request"
                                        >
                                          <IconCircleX size={11} />
                                          <span>Reject</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleReviewClick(item)}
                                          className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--ink)] px-2 text-[11px] font-medium shadow-2xs transition"
                                          title="Review live diff & details"
                                        >
                                          <IconEye size={11} />
                                          <span>Diff</span>
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleReviewClick(item)}
                                        className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-2 text-[11px] font-semibold shadow-2xs transition"
                                      >
                                        <IconClock size={11} />
                                        <span>Pending Sign-off</span>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleNavigateNotification(item)}
                                    className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-[var(--primary)] px-2.5 text-[11px] font-semibold text-white shadow-2xs hover:brightness-110 active:scale-95 transition"
                                  >
                                    <span>{actionLabel}</span>
                                    <IconArrowUpRight size={10} />
                                  </button>
                                )}
                              </td>

                              {/* More Controls (...) */}
                              <td className="py-2.5 text-right pr-3 relative">
                                <div className="inline-block relative">
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation()
                                      setActiveMenuId(isMenuOpen ? null : item.id)
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
                                    aria-label="More options"
                                  >
                                    <IconDotsVertical size={13} />
                                  </button>

                                  {isMenuOpen && (
                                    <div
                                      onClick={e => e.stopPropagation()}
                                      className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 text-xs shadow-xl"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => { setActiveMenuId(null); setDetailModal(item) }}
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                                      >
                                        <IconEye size={12} className="text-[var(--muted)]" />
                                        <span>View Details</span>
                                      </button>
                                      {item.requires_approval && item.status === 'active' && (
                                        <button
                                          type="button"
                                          onClick={() => { setActiveMenuId(null); handleReviewClick(item) }}
                                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                        >
                                          <IconUserCheck size={12} />
                                          <span>Authorize / Review</span>
                                        </button>
                                      )}
                                      {!item.is_read ? (
                                        <button
                                          type="button"
                                          onClick={() => { setActiveMenuId(null); handleMarkRead(item.id) }}
                                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                                        >
                                          <IconCheck size={12} className="text-emerald-600" />
                                          <span>Mark as Read</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveMenuId(null)
                                            setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: false } : n))
                                            setCounts(c => ({ ...c, unread: c.unread + 1 }))
                                          }}
                                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                                        >
                                          <IconClock size={12} className="text-blue-500" />
                                          <span>Mark as Unread</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => { setActiveMenuId(null); handleDismiss(item.id) }}
                                        disabled={dismissingId === item.id}
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                      >
                                        <IconTrash size={12} />
                                        <span>Dismiss Alert</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile & Tablet Notification Cards (md:hidden - Compact Button Sizes) */}
                  <div className="notification-card-list divide-y divide-[var(--line-subtle)]">
                    {items.map(item => {
                      const cfg = TYPE_CONFIG[item.notification_type] || { label: item.notification_type, icon: IconBell, badgeClass: 'status-neutral' }
                      const sev = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE.info
                      const TypeIcon = cfg.icon
                      const SevIcon = sev.icon
                      const actionLabel = getNotificationActionLabel(item)
                      const isApproval = item.requires_approval
                      const isMenuOpen = activeMenuId === item.id

                      return (
                        <article
                          key={item.id}
                          className={`notification-card p-3 sm:p-4 space-y-3 relative transition ${
                            !item.is_read
                              ? 'bg-blue-50/20 dark:bg-blue-950/20'
                              : 'bg-[var(--surface)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                style={item.is_read ? {} : { background: sev.dot }}
                                className={`inline-block h-2 w-2 rounded-full ${
                                  item.is_read ? 'bg-[var(--line-strong)] opacity-25' : ''
                                }`}
                              />
                              <span
                                style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}
                                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[9px] font-bold"
                              >
                                <SevIcon size={9} />
                                <span>{sev.label}</span>
                              </span>
                              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[9px] font-semibold ${cfg.badgeClass}`}>
                                <TypeIcon size={9} />
                                <span>{cfg.label}</span>
                              </span>
                            </div>

                            <span className="notification-card-time shrink-0 text-right">
                              <span className="block text-[11px] font-medium text-[var(--ink-secondary)]">{formatTime(item.created_at)}</span>
                              <span className="block text-[10px] text-[var(--muted)]">{relativeTime(item.created_at)}</span>
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="text-xs font-bold text-[var(--ink)] leading-snug">
                                {item.title}
                              </h3>
                              {isApproval && (
                                <span className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full ${
                                  item.status === 'approved' ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300' :
                                  item.status === 'rejected' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                                  'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}>
                                  {item.status === 'active' ? 'APPROVAL REQUIRED' : item.status}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-[var(--ink-secondary)] leading-relaxed">
                              {item.message}
                            </p>
                            <NotificationContextStrip item={item} />
                          </div>

                          <div className="flex items-center justify-between gap-1.5 border-t border-[var(--line-subtle)] pt-2">
                            {isApproval && item.status === 'active' ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {canManageApprovals ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleDirectApproval(item, 'approve')}
                                      disabled={actioningId === item.id}
                                      className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-2 text-[11px] font-semibold shadow-2xs transition"
                                      title="Authorize & execute request"
                                    >
                                      <IconCircleCheck size={11} />
                                      <span>{actioningId === item.id ? '…' : 'Approve'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDirectApproval(item, 'reject')}
                                      disabled={actioningId === item.id}
                                      className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 text-[11px] font-semibold shadow-2xs transition"
                                      title="Reject request"
                                    >
                                      <IconCircleX size={11} />
                                      <span>Reject</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleReviewClick(item)}
                                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--ink)] px-2 text-[11px] font-medium transition"
                                      title="Review live diff & details"
                                    >
                                      <IconEye size={11} />
                                      <span>Diff</span>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleReviewClick(item)}
                                    className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-2 text-[11px] font-semibold shadow-2xs transition"
                                  >
                                    <IconClock size={11} />
                                    <span>Pending Sign-off</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleNavigateNotification(item)}
                                className="inline-flex h-7 items-center gap-1 rounded-md bg-[var(--primary)] px-2.5 text-[11px] font-semibold text-white shadow-2xs hover:brightness-110 active:scale-95 transition"
                              >
                                <span>{actionLabel}</span>
                                <IconArrowUpRight size={11} />
                              </button>
                            )}

                            <div className="flex items-center gap-1 relative">
                              <button
                                type="button"
                                onClick={() => setDetailModal(item)}
                                className="notification-card-details inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-[var(--primary)] hover:bg-[var(--surface-elevated)]"
                              >
                                <IconEye size={12} />
                                <span>Details</span>
                              </button>
                              {!item.is_read && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkRead(item.id)}
                                  className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px] font-medium text-[var(--ink)] shadow-2xs hover:bg-[var(--surface-elevated)]"
                                  title="Mark as read"
                                >
                                  <IconCheck size={11} />
                                  <span>Read</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation()
                                  setActiveMenuId(isMenuOpen ? null : item.id)
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"
                                aria-label="More actions"
                              >
                                <IconDotsVertical size={13} />
                              </button>

                              {isMenuOpen && (
                                <div
                                  onClick={e => e.stopPropagation()}
                                  className="absolute right-0 bottom-9 z-30 w-40 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 text-xs shadow-xl"
                                >
                                  <button
                                    type="button"
                                    onClick={() => { setActiveMenuId(null); setDetailModal(item) }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                                  >
                                    <IconEye size={12} className="text-[var(--muted)]" />
                                    <span>View Details</span>
                                  </button>
                                  {item.requires_approval && item.status === 'active' && (
                                    <button
                                      type="button"
                                      onClick={() => { setActiveMenuId(null); handleReviewClick(item) }}
                                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-indigo-600 hover:bg-indigo-50"
                                    >
                                      <IconUserCheck size={12} />
                                      <span>Authorize</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => { setActiveMenuId(null); handleDismiss(item.id) }}
                                    disabled={dismissingId === item.id}
                                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                  >
                                    <IconTrash size={12} />
                                    <span>Dismiss</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── 6. Differentiated Empty States ── */
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
            {notifications.length === 0 ? (
              <>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <IconCircleCheck size={22} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--ink)]">You&apos;re all caught up!</h3>
                <p className="max-w-sm text-[11px] text-[var(--muted)] leading-relaxed">
                  No outstanding alerts require your attention. All operational monitors and approval queues are clear.
                </p>
                <button
                  type="button"
                  onClick={handleRunChecks}
                  disabled={refreshing}
                  className="btn-secondary mt-1 inline-flex h-8 items-center gap-1.5 text-xs px-3"
                >
                  <IconRefresh size={11} className={refreshing ? 'animate-spin' : ''} />
                  <span>Run System Check</span>
                </button>
              </>
            ) : (
              <>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-[var(--muted)] dark:bg-slate-800">
                  <IconFilter size={18} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--ink)]">No matching notifications</h3>
                <p className="max-w-sm text-[11px] text-[var(--muted)] leading-relaxed">
                  No alerts matched your active filters or search terms. Try loosening your criteria.
                </p>
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="mt-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  Clear all filters
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {/* ── 7. Slide-over Details Drawer (Right-Side on Mobile & Desktop) ── */}
      {detailModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs animate-in fade-in"
            onClick={() => setDetailModal(null)}
          />

          {/* Right-side Drawer */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-modal-title"
            className="fixed inset-y-0 right-0 z-50 flex flex-col w-[90vw] max-w-lg bg-[var(--surface)] shadow-2xl border-l border-[var(--line)] animate-in slide-in-from-right duration-200 overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-3.5 sm:p-4 bg-[var(--surface-elevated)]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    style={{
                      background: SEVERITY_STYLE[detailModal.severity]?.bg,
                      color: SEVERITY_STYLE[detailModal.severity]?.color,
                      border: `1px solid ${SEVERITY_STYLE[detailModal.severity]?.border}`,
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[9px] font-bold"
                  >
                    <span>{SEVERITY_STYLE[detailModal.severity]?.label}</span>
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[9px] font-semibold ${
                    TYPE_CONFIG[detailModal.notification_type]?.badgeClass || 'status-neutral'
                  }`}>
                    <span>{TYPE_CONFIG[detailModal.notification_type]?.label || detailModal.notification_type}</span>
                  </span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                    detailModal.is_read ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {detailModal.is_read ? 'Read' : 'Unread'}
                  </span>
                </div>
                <h3 id="detail-modal-title" className="mt-1.5 text-sm sm:text-base font-bold text-[var(--ink)] leading-snug">
                  {detailModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="text-[var(--muted)] hover:text-[var(--ink)] rounded-md p-1"
                aria-label="Close details"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="space-y-3.5 p-3.5 sm:p-4 overflow-y-auto flex-1">
              {/* Full Message */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 text-xs leading-relaxed text-[var(--ink)]">
                {detailModal.message}
              </div>

              {/* Threshold Rule if any */}
              {detailModal.data?.threshold_rule && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 flex items-center gap-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  <IconAlertCircle size={14} className="text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">Threshold Exceeded: </span>
                    <span>{detailModal.data.threshold_rule}</span>
                  </div>
                </div>
              )}

              {/* Side-by-side Current vs Proposed Data Diff if approval */}
              {(detailModal.data?.current_data || detailModal.data?.proposed_data) && (
                <DiffViewer
                  currentData={detailModal.data.current_data}
                  proposedData={detailModal.data.proposed_data}
                />
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] p-2.5">
                  <span className="text-[9px] font-bold uppercase text-[var(--muted)] block">Created At</span>
                  <span className="font-mono text-[var(--ink)] mt-0.5 block text-[11px]">{formatTime(detailModal.created_at)}</span>
                  <span className="text-[10px] text-[var(--muted)] font-mono">{relativeTime(detailModal.created_at)}</span>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] p-2.5">
                  <span className="text-[9px] font-bold uppercase text-[var(--muted)] block">Lifecycle Status</span>
                  <span className="font-semibold text-[var(--ink)] capitalize mt-0.5 block text-[11px]">{detailModal.status || 'Active'}</span>
                  {detailModal.actioned_by_name && (
                    <span className="text-[10px] text-[var(--muted)] truncate block">By: {detailModal.actioned_by_name}</span>
                  )}
                </div>
              </div>

              {/* Raw Event Attributes Table */}
              {detailModal.data && Object.keys(detailModal.data).length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Operational Event Attributes
                  </h4>
                  <div className="rounded-lg border border-[var(--line)] overflow-hidden">
                    <table className="table w-full text-xs">
                      <tbody className="divide-y divide-[var(--line-subtle)] font-mono text-[11px]">
                        {Object.entries(detailModal.data)
                          .filter(([k]) => !['current_data', 'proposed_data'].includes(k))
                          .map(([key, value]) => (
                            <tr key={key} className="hover:bg-[var(--surface-hover)]">
                              <td className="py-1 px-2.5 font-semibold text-[var(--muted)] capitalize w-2/5">
                                {key.replace(/_/g, ' ')}
                              </td>
                              <td className="py-1 px-2.5 text-[var(--ink)] truncate max-w-xs">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer (Compact Mobile Buttons) */}
            <div className="flex items-center justify-between gap-1.5 border-t border-[var(--line)] p-3 bg-[var(--surface-elevated)] mt-auto">
              <div className="flex items-center gap-1">
                {!detailModal.is_read && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(detailModal.id)}
                    className="btn-secondary h-7 sm:h-8 text-[11px] px-2.5 inline-flex items-center gap-1"
                  >
                    <IconCheck size={11} /> Mark Read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDismiss(detailModal.id)}
                  disabled={dismissingId === detailModal.id}
                  className="btn-secondary h-7 sm:h-8 text-[11px] px-2 text-red-600 hover:bg-red-50 hover:border-red-200 inline-flex items-center gap-1"
                >
                  <IconTrash size={11} /> Dismiss
                </button>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setDetailModal(null)}
                  className="btn-secondary h-7 sm:h-8 text-[11px] px-2.5"
                >
                  Close
                </button>
                {detailModal.requires_approval && detailModal.status === 'active' ? (
                  <div className="flex items-center gap-1.5">
                    {canManageApprovals && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const item = detailModal
                            setDetailModal(null)
                            handleDirectApproval(item, 'approve')
                          }}
                          className="h-7 sm:h-8 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs transition"
                          title="Authorize & execute request"
                        >
                          <IconCircleCheck size={12} />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const item = detailModal
                            setDetailModal(null)
                            handleDirectApproval(item, 'reject')
                          }}
                          className="h-7 sm:h-8 px-2.5 rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs transition"
                          title="Reject request"
                        >
                          <IconCircleX size={12} />
                          <span>Reject</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const item = detailModal
                        setDetailModal(null)
                        handleReviewClick(item)
                      }}
                      className="btn-primary h-7 sm:h-8 text-[11px] px-3 inline-flex items-center gap-1 font-semibold"
                    >
                      <IconUserCheck size={12} />
                      <span>{canManageApprovals ? 'Review Notes' : 'View Details'}</span>
                    </button>
                  </div>
                ) : getNotificationRoute(detailModal) ? (
                  <button
                    type="button"
                    onClick={() => {
                      const route = getNotificationRoute(detailModal)
                      setDetailModal(null)
                      if (!detailModal.is_read) handleMarkRead(detailModal.id)
                      navigate(route)
                    }}
                    className="btn-primary h-7 sm:h-8 text-[11px] px-3 inline-flex items-center gap-1 font-semibold"
                  >
                    <span>{getNotificationActionLabel(detailModal)}</span>
                    <IconExternalLink size={11} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── 8. Slide-over Quick Drawer (Visible on Desktop, Tablet & Mobile) ── */}
      {quickDrawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs animate-in fade-in"
            onClick={() => setQuickDrawerOpen(false)}
          />

          <aside
            className="fixed inset-y-0 right-0 z-50 flex flex-col w-[92vw] max-w-[420px] bg-[var(--surface)] shadow-2xl border-l border-[var(--line)] animate-in slide-in-from-right duration-200 text-[var(--ink)]"
            aria-label="Operational Notifications Feed"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] bg-[var(--surface-elevated)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 flex items-center justify-center text-[var(--primary)]">
                  <IconBell size={16} className={criticalCount > 0 ? 'text-red-600' : ''} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--ink)] text-sm">Operational Feed</span>
                    {needsActionCount > 0 && (
                      <span className="text-[10px] font-bold bg-[#1E3A5F] text-white px-1.5 py-0.2 rounded-full">
                        {needsActionCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--muted)]">Real-time alerts & work items</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                aria-label="Close drawer"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-2 p-3 border-b border-[var(--line)] bg-[var(--surface)]">
              <div className="p-2 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 text-center">
                <span className="text-[9px] font-bold uppercase text-red-700 block">Critical</span>
                <span className="text-lg font-bold font-mono text-red-600">{criticalCount}</span>
              </div>
              <div className="p-2 rounded-lg border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 text-center">
                <span className="text-[9px] font-bold uppercase text-indigo-700 block">Approvals</span>
                <span className="text-lg font-bold font-mono text-indigo-600">{pendingApprovalCount}</span>
              </div>
            </div>

            {/* Urgent Alerts Feed */}
            <div className="divide-y divide-[var(--line-subtle)] overflow-y-auto flex-1">
              {notifications.slice(0, 15).map(item => {
                const isApproval = item.requires_approval
                const isPendingPO = item.notification_type === 'purchase_order_pending'

                return (
                  <div
                    key={item.id}
                    className="p-3 text-left hover:bg-[var(--surface-hover)] transition-colors space-y-2 border-l-3 border-l-transparent hover:border-l-[var(--primary)]"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[var(--muted)] mb-1">
                      <span className="font-semibold uppercase text-[var(--ink)]">
                        {TYPE_CONFIG[item.notification_type]?.label || item.notification_type}
                      </span>
                      <span className="font-mono">{relativeTime(item.created_at)}</span>
                    </div>

                    <div
                      onClick={() => {
                        setQuickDrawerOpen(false)
                        handleNavigateNotification(item)
                      }}
                      className="cursor-pointer group"
                    >
                      <p className="text-xs font-bold text-[var(--ink)] line-clamp-1 group-hover:text-[var(--primary)] transition-colors">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[var(--ink-secondary)] line-clamp-2 mt-0.5">
                        {item.message}
                      </p>
                    </div>

                    {/* Inline Actions inside drawer */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--line-subtle)]">
                      {isApproval && item.status === 'active' ? (
                        <div className="flex items-center gap-1.5">
                          {canManageApprovals ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDirectApproval(item, 'approve')}
                                disabled={actioningId === item.id}
                                className="h-6 px-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold inline-flex items-center gap-1"
                              >
                                <IconCircleCheck size={11} /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDirectApproval(item, 'reject')}
                                disabled={actioningId === item.id}
                                className="h-6 px-2 rounded border border-rose-300 dark:border-rose-800 bg-rose-50 text-rose-700 dark:text-rose-300 text-[10px] font-semibold inline-flex items-center gap-1"
                              >
                                <IconCircleX size={11} /> Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                              Pending Sign-off
                            </span>
                          )}
                        </div>
                      ) : isPendingPO ? (
                        <button
                          type="button"
                          onClick={() => {
                            setQuickDrawerOpen(false)
                            handleNavigateNotification(item)
                          }}
                          className="h-6 px-2 rounded bg-[var(--primary)] text-white text-[10px] font-semibold inline-flex items-center gap-1"
                        >
                          Review PO <IconArrowUpRight size={10} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setQuickDrawerOpen(false)
                            handleNavigateNotification(item)
                          }}
                          className="h-6 px-2 rounded border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--ink)] text-[10px] font-medium inline-flex items-center gap-1"
                        >
                          {getNotificationActionLabel(item)} <IconArrowUpRight size={10} />
                        </button>
                      )}

                      {!item.is_read && (
                        <button
                          type="button"
                          onClick={async e => {
                            e.stopPropagation()
                            await handleMarkRead(item.id)
                          }}
                          className="h-6 px-1.5 text-[10px] text-[var(--muted)] hover:text-[var(--ink)] inline-flex items-center gap-0.5"
                          title="Mark read"
                        >
                          <IconCheck size={11} /> Read
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Drawer Actions */}
            <div className="p-3 border-t border-[var(--line)] bg-[var(--surface-elevated)] flex gap-2">
              <button
                type="button"
                onClick={() => { setQuickDrawerOpen(false); handleRunChecks() }}
                className="btn-secondary flex-1 h-8 text-xs inline-flex items-center justify-center gap-1"
              >
                <IconRefresh size={12} className={refreshing ? 'animate-spin' : ''} /> Scan
              </button>
              <button
                type="button"
                onClick={() => { setQuickDrawerOpen(false); handleSettingsClick() }}
                className="btn-secondary flex-1 h-8 text-xs inline-flex items-center justify-center gap-1"
              >
                <IconSettings size={12} /> Settings
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ── 9. Approval Review & Authorization Modal ── */}
      {approvalModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approval-modal-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => { setApprovalModal(null); setApprovalNotes('') }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-2xl sm:rounded-2xl overflow-hidden animate-in fade-in"
          >
            {/* Modal Header */}
            <div className="mb-2.5 flex items-start justify-between gap-3 border-b border-[var(--line)] pb-2.5">
              <div>
                <span className={`inline-flex rounded-full px-2 py-0.2 text-[9px] font-bold uppercase tracking-wide ${
                  approvalModal.type === 'approve' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' :
                  approvalModal.type === 'reject' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                }`}>
                  {approvalModal.type === 'view' ? 'Approval Details' : 'Administrator Authorization'}
                </span>
                <h3 id="approval-modal-title" className="mb-0 mt-1 text-sm sm:text-base font-bold text-[var(--ink)]">
                  {approvalModal.type === 'approve' ? 'Authorize & Execute Request' :
                   approvalModal.type === 'reject' ? 'Reject Authorization Request' :
                   'Request Diff & Authorization Details'}
                </h3>
                <p className="mb-0 mt-0.5 text-xs font-semibold text-[var(--ink-secondary)] truncate">{approvalModal.title}</p>
              </div>
              <button
                type="button"
                onClick={() => { setApprovalModal(null); setApprovalNotes('') }}
                className="text-[var(--muted)] hover:text-[var(--ink)] shrink-0 rounded-md p-1"
                aria-label="Close modal"
              >
                <IconX size={15} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="space-y-2.5 overflow-y-auto pr-1 py-1 text-xs">
              {/* Threshold Rule Warning Banner */}
              {approvalModal.data?.threshold_rule && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/50 p-2 flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-200">
                  <IconAlertCircle size={14} className="text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">Threshold Exceeded: </span>
                    <span>{approvalModal.data.threshold_rule}</span>
                  </div>
                </div>
              )}

              {/* Side-by-side Current vs Proposed Data Diff */}
              {(approvalModal.data?.current_data || approvalModal.data?.proposed_data) && (
                <DiffViewer
                  currentData={approvalModal.data.current_data}
                  proposedData={approvalModal.data.proposed_data}
                />
              )}

              {approvalModal.message && (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
                  {approvalModal.message}
                </div>
              )}

              {approvalModal.type !== 'view' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[var(--ink-secondary)]">
                    Authorization Note {approvalModal.type === 'reject' ? '(recommended)' : '(optional)'}
                  </label>
                  <textarea
                    value={approvalNotes}
                    onChange={e => setApprovalNotes(e.target.value)}
                    placeholder="Add authorization reference or reason..."
                    rows={2}
                    className="w-full p-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
              )}

              <p className="text-[9px] text-[var(--muted)] leading-relaxed">
                This transaction executes under atomic database isolation and logs immutable before/after diffs in the AuditLog.
              </p>
            </div>

            {/* Modal Actions (Lower Button Sizes on Mobile) */}
            <div className="mt-2.5 flex flex-wrap items-center justify-end gap-1.5 border-t border-[var(--line)] pt-2.5">
              <button
                type="button"
                onClick={() => { setApprovalModal(null); setApprovalNotes('') }}
                className="btn-secondary h-7 sm:h-8 text-[11px] sm:text-xs px-3"
              >
                {approvalModal.type === 'view' ? 'Close' : 'Cancel'}
              </button>

              {approvalModal.type !== 'view' && canManageApprovals && (
                <>
                  <button
                    type="button"
                    onClick={() => handleApprovalAction(approvalModal.id, 'reject')}
                    disabled={Boolean(actioningId)}
                    className="h-7 sm:h-8 text-[11px] sm:text-xs px-3 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg inline-flex items-center justify-center gap-1 disabled:opacity-60 transition"
                  >
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprovalAction(approvalModal.id, 'approve')}
                    disabled={Boolean(actioningId)}
                    className="h-7 sm:h-8 text-[11px] sm:text-xs px-3 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg inline-flex items-center justify-center gap-1 disabled:cursor-wait disabled:opacity-60 shadow-2xs transition"
                  >
                    {actioningId === approvalModal.id && <IconRefresh size={11} className="animate-spin" />}
                    <span>Confirm Approval</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
