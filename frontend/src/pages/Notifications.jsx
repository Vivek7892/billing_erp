import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  IndianRupee,
  Layers,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  Truck,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react'
import api from '../api'
import { Badge, Card } from '../components/UI'

const TYPE_CONFIG = {
  low_stock: {
    label: 'Low Stock',
    icon: Package,
    badgeClass: 'badge-low-stock',
    category: 'inventory',
  },
  invoice_overdue: {
    label: 'Invoice Overdue',
    icon: FileText,
    badgeClass: 'badge-overdue',
    category: 'sales_finance',
  },
  payment_received: {
    label: 'Payment Received',
    icon: CreditCard,
    badgeClass: 'badge-paid',
    category: 'sales_finance',
  },
  purchase_order_pending: {
    label: 'PO Pending',
    icon: ShoppingBag,
    badgeClass: 'badge-pending',
    category: 'sales_finance',
  },
  quotation_expiring: {
    label: 'Quotation Expiring',
    icon: Layers,
    badgeClass: 'badge-pending',
    category: 'sales_finance',
  },
  batch_expiring: {
    label: 'Batch Expiring',
    icon: AlertTriangle,
    badgeClass: 'badge-overdue',
    category: 'inventory',
  },
  gst_submission_failed: {
    label: 'GST Filing Alert',
    icon: ShieldAlert,
    badgeClass: 'badge-overdue',
    category: 'compliance',
  },
  einvoice_failed: {
    label: 'E-Invoice Error',
    icon: AlertCircle,
    badgeClass: 'badge-overdue',
    category: 'compliance',
  },
  eway_bill_expiring: {
    label: 'E-Way Bill Expiring',
    icon: Truck,
    badgeClass: 'badge-pending',
    category: 'compliance',
  },
  approval_required: {
    label: 'Approval Required',
    icon: UserCheck,
    badgeClass: 'badge-active',
    category: 'approvals',
  },
}

function formatTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export default function Notifications() {
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState([])
  const [counts, setCounts] = useState({
    unread: 0,
    critical: 0,
    pending_approval: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all') // all | unread | critical | approvals | inventory | sales_finance | compliance
  const [typeFilter, setTypeFilter] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [approvalModal, setApprovalModal] = useState(null)
  const [approvalNotes, setApprovalNotes] = useState('')

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

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleRunChecks = async () => {
    try {
      setRefreshing(true)
      await api.post('/notifications/run-checks/')
      await fetchNotifications(true)
      toast.success('Alerts refreshed across all 10 engines')
    } catch {
      toast.error('Failed to trigger notification scan')
      setRefreshing(false)
    }
  }

  const handleMarkRead = async id => {
    try {
      await api.post(`/notifications/${id}/read/`)
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      )
      setCounts(c => ({ ...c, unread: Math.max(0, c.unread - 1) }))
      toast.success('Marked as read')
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

  const handleApprovalAction = async (id, action) => {
    try {
      setActioningId(id)
      const res = await api.post(`/notifications/${id}/action/`, {
        action,
        notes: approvalNotes,
      })
      setNotifications(prev =>
        prev.map(n =>
          n.id === id
            ? { ...n, status: res.data.notification_status, is_read: true }
            : n
        )
      )
      setCounts(c => ({
        ...c,
        pending_approval: Math.max(0, c.pending_approval - 1),
      }))
      setApprovalModal(null)
      setApprovalNotes('')
      toast.success(`Action successfully ${action}d`)
    } catch (err) {
      toast.error(err?.response?.data?.error || `Failed to ${action} action`)
    } finally {
      setActioningId(null)
    }
  }

  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      // Tab filtering
      if (activeTab === 'unread' && item.is_read) return false
      if (activeTab === 'critical' && !['danger', 'warning'].includes(item.severity)) return false
      if (activeTab === 'approvals' && !item.requires_approval) return false

      if (['inventory', 'sales_finance', 'compliance'].includes(activeTab)) {
        const cat = TYPE_CONFIG[item.notification_type]?.category
        if (cat !== activeTab) return false
      }

      // Type filter
      if (typeFilter && item.notification_type !== typeFilter) return false

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase()
        const titleMatch = item.title?.toLowerCase().includes(q)
        const msgMatch = item.message?.toLowerCase().includes(q)
        return titleMatch || msgMatch
      }

      return true
    })
  }, [notifications, activeTab, typeFilter, search])

  const tabList = [
    { key: 'all', label: 'All Alerts', count: notifications.length },
    { key: 'unread', label: 'Unread', count: counts.unread },
    { key: 'critical', label: 'Critical', count: counts.critical },
    { key: 'approvals', label: 'Approvals', count: counts.pending_approval },
    { key: 'inventory', label: 'Stock & Batches' },
    { key: 'sales_finance', label: 'Sales & Finance' },
    { key: 'compliance', label: 'GST & Compliance' },
  ]

  return (
    <div className="min-w-0 space-y-4 pb-6">
      {/* -------------------------------------------------------------
          TOP BAR: Title & Actions
      -------------------------------------------------------------- */}
      <header className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Real-Time Alert Engine
              </p>
            </div>
            <h1 className="mt-0.5 truncate text-lg sm:text-xl font-bold text-[var(--ink)]">
              Notifications & Alerts Center
            </h1>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Automated monitoring for stock, invoices, approvals, and statutory compliance
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunChecks}
              disabled={refreshing}
              className="btn-secondary h-9 text-xs px-3 inline-flex items-center gap-1.5"
              title="Scan all 10 alert engines"
            >
              <RefreshCw
                size={14}
                className={refreshing ? 'animate-spin' : ''}
              />
              <span>Scan & Refresh</span>
            </button>

            {counts.unread > 0 && (
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

      {/* -------------------------------------------------------------
          METRICS BAR (Table-First ERP Style)
      -------------------------------------------------------------- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Total Alerts
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-[var(--ink)]">
            {notifications.length}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">Active system notifications</p>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Unread Alerts
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-[var(--primary)]">
            {counts.unread}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">Awaiting review</p>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Critical Alerts
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-red-600">
            {counts.critical}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">High priority / risk</p>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Pending Approvals
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-amber-600">
            {counts.pending_approval}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">Staff actions requiring sign-off</p>
        </div>
      </section>

      {/* -------------------------------------------------------------
          FILTER TABS & TOOLBAR
      -------------------------------------------------------------- */}
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
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--ink)]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
          >
            <option value="">All Categories (10 Channels)</option>
            {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
              <option key={k} value={k}>
                {cfg.label}
              </option>
            ))}
          </select>

          <span className="text-[11px] text-[var(--muted)] ml-auto">
            Showing {filteredNotifications.length} of {notifications.length} notifications
          </span>
        </div>
      </section>

      {/* -------------------------------------------------------------
          MAIN NOTIFICATIONS DATA TABLE
      -------------------------------------------------------------- */}
      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--muted)] animate-pulse">
            Loading notifications and scanning engine...
          </div>
        ) : filteredNotifications.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10 text-center">Status</th>
                  <th>Category</th>
                  <th>Alert Details</th>
                  <th>Created</th>
                  <th>Recommended Action</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotifications.map(item => {
                  const cfg = TYPE_CONFIG[item.notification_type] || {
                    label: item.notification_type,
                    icon: Bell,
                    badgeClass: 'status-neutral',
                  }
                  const Icon = cfg.icon

                  const rowClass =
                    item.severity === 'danger'
                      ? 'row-overdue'
                      : item.severity === 'warning'
                        ? 'row-pending'
                        : item.severity === 'success'
                          ? 'row-paid'
                          : 'row-info'

                  return (
                    <tr
                      key={item.id}
                      className={[
                        rowClass,
                        !item.is_read ? 'font-medium' : 'opacity-85',
                      ].join(' ')}
                    >
                      {/* Read indicator */}
                      <td className="text-center">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            item.is_read
                              ? 'bg-[var(--line-strong)] opacity-40'
                              : 'bg-[var(--primary)]'
                          }`}
                          title={item.is_read ? 'Read' : 'Unread'}
                        />
                      </td>

                      {/* Notification Type & Badge */}
                      <td>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badgeClass}`}
                        >
                          <Icon size={11} />
                          <span>{cfg.label}</span>
                        </span>
                      </td>

                      {/* Content */}
                      <td className="max-w-md">
                        <div className="font-bold text-xs text-[var(--ink)]">
                          {item.title}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--ink-secondary)] leading-relaxed">
                          {item.message}
                        </p>
                        {item.requires_approval && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                                item.status === 'approved'
                                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                                  : item.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              Status: {item.status.toUpperCase()}
                            </span>
                            {item.actioned_by_name && (
                              <span className="text-[10px] text-[var(--muted)]">
                                by {item.actioned_by_name}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="whitespace-nowrap text-xs font-mono text-[var(--muted)]">
                        {formatTime(item.created_at)}
                      </td>

                      {/* Action URL link */}
                      <td>
                        {item.action_url ? (
                          <button
                            onClick={() => {
                              if (!item.is_read) handleMarkRead(item.id)
                              navigate(item.action_url)
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                          >
                            <span>{item.action_label || 'View'}</span>
                            <ArrowUpRight size={12} />
                          </button>
                        ) : (
                          <span className="text-[11px] text-[var(--muted)]">—</span>
                        )}
                      </td>

                      {/* Inline Actions */}
                      <td className="text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {item.requires_approval && item.status === 'active' ? (
                            <>
                              <button
                                onClick={() => {
                                  setApprovalModal({
                                    id: item.id,
                                    title: item.title,
                                    type: 'approve',
                                  })
                                }}
                                disabled={actioningId === item.id}
                                className="btn-success btn-sm text-[11px] px-2.5 inline-flex items-center gap-1"
                              >
                                <Check size={12} />
                                <span>Approve</span>
                              </button>

                              <button
                                onClick={() => {
                                  setApprovalModal({
                                    id: item.id,
                                    title: item.title,
                                    type: 'reject',
                                  })
                                }}
                                disabled={actioningId === item.id}
                                className="btn-danger btn-sm text-[11px] px-2.5 inline-flex items-center gap-1"
                              >
                                <X size={12} />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : (
                            !item.is_read && (
                              <button
                                onClick={() => handleMarkRead(item.id)}
                                className="btn-secondary btn-sm text-xs px-2"
                                title="Mark as read"
                              >
                                <Check size={12} />
                              </button>
                            )
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
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 p-6 text-center">
            <CheckCircle2 size={24} className="text-teal-600" />
            <p className="text-xs font-semibold text-[var(--ink)]">
              No notifications matching your criteria
            </p>
            <p className="text-[11px] text-[var(--muted)]">
              All monitored inventory, billing, compliance, and approval channels are operating normally.
            </p>
          </div>
        )}
      </section>

      {/* -------------------------------------------------------------
          APPROVAL MODAL
      -------------------------------------------------------------- */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-lg">
            <h3 className="text-sm font-bold text-[var(--ink)]">
              Confirm {approvalModal.type === 'approve' ? 'Approval' : 'Rejection'}
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {approvalModal.title}
            </p>

            <div className="mt-3.5 space-y-1.5">
              <label className="text-xs font-medium text-[var(--ink-secondary)]">
                Supervisor / Manager Notes (Optional)
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
                onClick={() => {
                  setApprovalModal(null)
                  setApprovalNotes('')
                }}
                className="btn-secondary text-xs h-8 px-3"
              >
                Cancel
              </button>

              <button
                onClick={() =>
                  handleApprovalAction(approvalModal.id, approvalModal.type)
                }
                className={`text-xs h-8 px-3 font-semibold text-white rounded-md ${
                  approvalModal.type === 'approve'
                    ? 'bg-teal-600 hover:bg-teal-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Confirm {approvalModal.type === 'approve' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
