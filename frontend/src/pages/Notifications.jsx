import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  Layers,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingBag,
  Trash2,
  Truck,
  UserCheck,
  X,
  Info,
} from 'lucide-react'
import api from '../api'

// ─── Config ────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  low_stock:              { label: 'Low Stock',        icon: Package,    badgeClass: 'badge-low-stock', category: 'inventory' },
  invoice_overdue:        { label: 'Invoice Overdue',  icon: FileText,   badgeClass: 'badge-overdue',   category: 'sales_finance' },
  payment_received:       { label: 'Payment Received', icon: CreditCard, badgeClass: 'badge-paid',      category: 'sales_finance' },
  purchase_order_pending: { label: 'PO Pending',       icon: ShoppingBag,badgeClass: 'badge-pending',   category: 'sales_finance' },
  quotation_expiring:     { label: 'Quotation Expiring',icon: Layers,    badgeClass: 'badge-pending',   category: 'sales_finance' },
  batch_expiring:         { label: 'Batch Expiring',   icon: AlertTriangle,badgeClass:'badge-overdue',  category: 'inventory' },
  gst_submission_failed:  { label: 'GST Filing Alert', icon: ShieldAlert,badgeClass: 'badge-overdue',   category: 'compliance' },
  einvoice_failed:        { label: 'E-Invoice Error',  icon: AlertCircle,badgeClass: 'badge-overdue',   category: 'compliance' },
  eway_bill_expiring:     { label: 'E-Way Bill',       icon: Truck,      badgeClass: 'badge-pending',   category: 'compliance' },
  approval_required:      { label: 'Approval Required',icon: UserCheck,  badgeClass: 'badge-active',    category: 'approvals' },
}

// Severity badge uses inline styles to guarantee visibility regardless of Tailwind purge
const SEVERITY_STYLE = {
  danger:  {
    dot: '#EF4444',
    bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C',
    icon: AlertCircle,
    label: 'Danger',
  },
  warning: {
    dot: '#F59E0B',
    bg: '#FFFBEB', border: '#FDE68A', color: '#B45309',
    icon: AlertTriangle,
    label: 'Warning',
  },
  success: {
    dot: '#10B981',
    bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D',
    icon: CheckCircle2,
    label: 'Success',
  },
  info: {
    dot: '#3B82F6',
    bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8',
    icon: Info,
    label: 'Info',
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

function relativeTime(isoString) {
  if (!isoString) return ''
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ─── Metric Card ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, valueColor, icon: Icon, iconBg, iconColor }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3.5 flex items-start gap-3">
      {Icon && (
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg, border: `1px solid ${iconColor}22` }}
        >
          <Icon size={16} style={{ color: iconColor }} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p>
        <p className="mt-0.5 font-mono text-xl font-bold" style={{ color: valueColor }}>{value}</p>
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">{sub}</p>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function Notifications() {
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState([])
  const [counts, setCounts] = useState({ unread: 0, critical: 0, pending_approval: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [typeFilter, setTypeFilter] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [approvalModal, setApprovalModal] = useState(null)
  const [approvalNotes, setApprovalNotes] = useState('')
  const [dismissingId, setDismissingId] = useState(null)

  const fetchNotifications = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setRefreshing(true)
      const res = await api.get('/notifications/')
      setNotifications(res.data.notifications || [])
      setCounts({
        unread: res.data.unread_count || 0,
        critical: res.data.critical_count || 0,
        pending_approval: res.data.pending_approval_count || 0,
      })
    } catch {
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const handleRunChecks = async () => {
    try {
      setRefreshing(true)
      await api.post('/notifications/run-checks/')
      await fetchNotifications(true)
      toast.success('Alerts refreshed')
    } catch {
      toast.error('Failed to trigger notification scan')
      setRefreshing(false)
    }
  }

  const handleMarkRead = async id => {
    try {
      await api.post(`/notifications/${id}/read/`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setCounts(c => ({ ...c, unread: Math.max(0, c.unread - 1) }))
    } catch {
      toast.error('Could not update notification')
    }
  }

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

  const handleDismiss = async id => {
    try {
      setDismissingId(id)
      await api.post(`/notifications/${id}/read/`)
      setNotifications(prev => prev.filter(n => n.id !== id))
      setCounts(c => ({ ...c, unread: Math.max(0, c.unread - 1) }))
      toast.success('Notification dismissed')
    } catch {
      toast.error('Could not dismiss notification')
    } finally {
      setDismissingId(null)
    }
  }

  const handleApprovalAction = async (id, action) => {
    try {
      setActioningId(id)
      const res = await api.post(`/notifications/${id}/action/`, { action, notes: approvalNotes })
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, status: res.data.notification_status, is_read: true } : n)
      )
      setCounts(c => ({ ...c, pending_approval: Math.max(0, c.pending_approval - 1) }))
      setApprovalModal(null)
      setApprovalNotes('')
      toast.success(`Action ${action}d successfully`)
    } catch (err) {
      toast.error(err?.response?.data?.error || `Failed to ${action}`)
    } finally {
      setActioningId(null)
    }
  }

  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      if (activeTab === 'unread' && item.is_read) return false
      if (activeTab === 'critical' && !['danger', 'warning'].includes(item.severity)) return false
      if (activeTab === 'approvals' && !item.requires_approval) return false
      if (['inventory', 'sales_finance', 'compliance'].includes(activeTab)) {
        if (TYPE_CONFIG[item.notification_type]?.category !== activeTab) return false
      }
      if (typeFilter && item.notification_type !== typeFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return item.title?.toLowerCase().includes(q) || item.message?.toLowerCase().includes(q)
      }
      return true
    })
  }, [notifications, activeTab, typeFilter, search])

  // Only show "Mark All Read" if there are unread items in the current filtered view
  const filteredUnreadCount = useMemo(
    () => filteredNotifications.filter(n => !n.is_read).length,
    [filteredNotifications]
  )

  const tabList = [
    { key: 'all',          label: 'All',            count: notifications.length },
    { key: 'unread',       label: 'Unread',         count: counts.unread },
    { key: 'critical',     label: 'Critical',       count: counts.critical },
    { key: 'approvals',    label: 'Approvals',      count: counts.pending_approval },
    { key: 'inventory',    label: 'Stock & Batches' },
    { key: 'sales_finance',label: 'Sales & Finance' },
    { key: 'compliance',   label: 'GST & Compliance' },
  ]

  return (
    <div className="notifications-page min-w-0 space-y-4 pb-6">

      {/* ── Header ── */}
      <header className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Real-Time Alert Engine</p>
            </div>
            <h1 className="mt-0.5 truncate text-lg sm:text-xl font-bold text-[var(--ink)]">
              Notifications & Alerts Center
            </h1>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Automated monitoring for stock, invoices, approvals, and compliance
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunChecks}
              disabled={refreshing}
              className="btn-secondary h-9 text-xs px-3 inline-flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>Scan & Refresh</span>
            </button>
            {filteredUnreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="btn-secondary h-9 text-xs px-3 inline-flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Mark All Read</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Metrics ── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Total Alerts"
          value={notifications.length}
          sub="Active notifications"
          icon={Bell}
          iconBg="#EFF6FF"
          iconColor="#1D4ED8"
          valueColor="#172033"
        />
        <MetricCard
          label="Unread"
          value={counts.unread}
          sub="Awaiting review"
          icon={Bell}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
          valueColor="#1E3A5F"
        />
        <MetricCard
          label="Critical"
          value={counts.critical}
          sub="High priority / risk"
          icon={AlertCircle}
          iconBg="#FEF2F2"
          iconColor="#B91C1C"
          valueColor="#B91C1C"
        />
        <MetricCard
          label="Pending Approvals"
          value={counts.pending_approval}
          sub="Require sign-off"
          icon={UserCheck}
          iconBg="#FFFBEB"
          iconColor="#B45309"
          valueColor="#B45309"
        />
      </section>

      {/* ── Tabs & Toolbar ── */}
      <section className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] pb-2">
          {tabList.map(tab => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] ${
                    active ? 'bg-white/20 text-white' : 'bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--ink)]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]">
                <X size={12} />
              </button>
            )}
          </div>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
          >
            <option value="">All Types</option>
            {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
              <option key={k} value={k}>{cfg.label}</option>
            ))}
          </select>

          <span className="text-[11px] text-[var(--muted)] ml-auto">
            {filteredNotifications.length} of {notifications.length} shown
          </span>
        </div>
      </section>

      {/* ── Table ── */}
      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
              <RefreshCw size={14} className="animate-spin" />
              Loading notifications...
            </div>
          </div>
        ) : filteredNotifications.length ? (
          <div className="overflow-x-auto">
            <table className="table notifications-table">
              <thead>
                <tr>
                  <th className="w-8 text-center">·</th>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Alert Details</th>
                  <th>Time</th>
                  <th>Action</th>
                  <th className="text-right">Controls</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotifications.map(item => {
                  const cfg = TYPE_CONFIG[item.notification_type] || { label: item.notification_type, icon: Bell, badgeClass: 'status-neutral' }
                  const sev = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE.info
                  const TypeIcon = cfg.icon
                  const SevIcon = sev.icon

                  const rowClass =
                    item.severity === 'danger' ? 'row-overdue' :
                    item.severity === 'warning' ? 'row-pending' :
                    item.severity === 'success' ? 'row-paid' : 'row-info'

                  return (
                    <tr
                      key={item.id}
                      className={[rowClass, !item.is_read ? 'font-medium' : 'opacity-80'].join(' ')}
                    >
                      {/* Unread dot */}
                      <td className="text-center">
                        <span
                          style={item.is_read ? {} : { background: sev.dot }}
                          className={`inline-block h-2 w-2 rounded-full ${item.is_read ? 'bg-[var(--line-strong)] opacity-30' : ''}`}
                          title={item.is_read ? 'Read' : 'Unread'}
                        />
                      </td>

                      {/* Severity badge with icon */}
                      <td>
                        <span
                          style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
                        >
                          <SevIcon size={11} />
                          <span>{sev.label}</span>
                        </span>
                      </td>

                      {/* Type badge */}
                      <td>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badgeClass}`}>
                          <TypeIcon size={10} />
                          <span>{cfg.label}</span>
                        </span>
                      </td>

                      {/* Content */}
                      <td className="max-w-xs">
                        <div className="font-bold text-xs text-[var(--ink)] leading-snug">{item.title}</div>
                        <p className="mt-0.5 text-xs text-[var(--ink-secondary)] leading-relaxed line-clamp-2">
                          {item.message}
                        </p>
                        {item.requires_approval && (
                          <span className={`mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.status === 'approved' ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300' :
                            item.status === 'rejected' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                            'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}>
                            {item.status?.toUpperCase()}
                            {item.actioned_by_name ? ` · ${item.actioned_by_name}` : ''}
                          </span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="whitespace-nowrap">
                        <div className="text-xs font-mono text-[var(--ink-secondary)]">{formatTime(item.created_at)}</div>
                        <div className="text-[10px] text-[var(--muted)] mt-0.5">{relativeTime(item.created_at)}</div>
                      </td>

                      {/* Action URL */}
                      <td>
                        {item.action_url ? (
                          <button
                            onClick={() => { if (!item.is_read) handleMarkRead(item.id); navigate(item.action_url) }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                          >
                            <span>{item.action_label || 'View'}</span>
                            <ArrowUpRight size={11} />
                          </button>
                        ) : (
                          <span className="text-[11px] text-[var(--muted)]">—</span>
                        )}
                      </td>

                      {/* Controls */}
                      <td className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {item.requires_approval && item.status === 'active' ? (
                            <>
                              <button
                                onClick={() => setApprovalModal({ id: item.id, title: item.title, type: 'approve' })}
                                disabled={actioningId === item.id}
                                className="btn-success btn-sm text-[11px] px-2 inline-flex items-center gap-1"
                              >
                                <Check size={11} /> Approve
                              </button>
                              <button
                                onClick={() => setApprovalModal({ id: item.id, title: item.title, type: 'reject' })}
                                disabled={actioningId === item.id}
                                className="btn-danger btn-sm text-[11px] px-2 inline-flex items-center gap-1"
                              >
                                <X size={11} /> Reject
                              </button>
                            </>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              {!item.is_read && (
                                <button
                                  onClick={() => handleMarkRead(item.id)}
                                  className="btn-secondary btn-sm text-xs px-2"
                                  title="Mark as read"
                                >
                                  <Check size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDismiss(item.id)}
                                disabled={dismissingId === item.id}
                                className="btn-sm text-xs px-2 inline-flex items-center justify-center border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded transition-colors"
                                title="Dismiss notification"
                              >
                                <Trash2 size={12} />
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
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
            <CheckCircle2 size={28} className="text-teal-500" />
            <p className="text-sm font-semibold text-[var(--ink)]">All clear!</p>
            <p className="text-xs text-[var(--muted)]">
              No notifications match your current filters.
            </p>
            {(search || typeFilter || activeTab !== 'all') && (
              <button
                onClick={() => { setSearch(''); setTypeFilter(''); setActiveTab('all') }}
                className="mt-1 text-xs font-semibold text-[var(--primary)] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Approval Modal ── */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-lg modal-shell">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  Confirm {approvalModal.type === 'approve' ? 'Approval' : 'Rejection'}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{approvalModal.title}</p>
              </div>
              <button
                onClick={() => { setApprovalModal(null); setApprovalNotes('') }}
                className="text-[var(--muted)] hover:text-[var(--ink)] flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--ink-secondary)]">
                Notes (Optional)
              </label>
              <textarea
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                placeholder="Reason or authorization reference..."
                rows={3}
                className="w-full p-2 text-xs rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => { setApprovalModal(null); setApprovalNotes('') }}
                className="btn-secondary text-xs h-8 px-3"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprovalAction(approvalModal.id, approvalModal.type)}
                disabled={actioningId === approvalModal.id}
                className={`text-xs h-8 px-4 font-semibold text-white rounded-md inline-flex items-center gap-1.5 ${
                  approvalModal.type === 'approve' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actioningId === approvalModal.id && <RefreshCw size={12} className="animate-spin" />}
                Confirm {approvalModal.type === 'approve' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
