import { useState, useEffect, useMemo } from 'react'
import api from '../api'
import { PageHeader, Spinner, Modal, Pagination } from '../components/UI'
import toast from 'react-hot-toast'
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  RotateCcw,
  ArrowRight,
  Eye,
  Download,
  Laptop,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Tag,
  Clock,
  Layers,
  Info,
} from 'lucide-react'

function parseJsonSafe(val) {
  if (!val) return null
  if (typeof val === 'object') return val
  try {
    return JSON.parse(val)
  } catch {
    return val
  }
}

export default function AuditTrail() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [resultFilter, setResultFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  const resetFilters = () => {
    setSearch('')
    setActionFilter('ALL')
    setResultFilter('ALL')
    setDateFrom('')
    setDateTo('')
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const res = await api.get('/audit-logs/', { params })
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setLogs(data)
    } catch {
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [dateFrom, dateTo])

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Action filter
      if (actionFilter !== 'ALL') {
        if (actionFilter === 'INVOICE' && !log.action.includes('INVOICE')) return false
        if (actionFilter === 'PRICE' && log.action !== 'PRICE_CHANGED') return false
        if (actionFilter === 'STOCK' && !log.action.includes('STOCK')) return false
        if (actionFilter === 'LOGIN' && !log.action.includes('LOGIN')) return false
        if (actionFilter === 'SETTINGS' && !log.action.includes('SETTING')) return false
        if (actionFilter === 'USER' && !log.action.includes('USER')) return false
        if (actionFilter === 'MASTER' && !['CUSTOMER_CREATED', 'CUSTOMER_UPDATED', 'SUPPLIER_CREATED', 'SUPPLIER_UPDATED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_ARCHIVED'].includes(log.action)) return false
      }

      // Result filter
      if (resultFilter !== 'ALL') {
        if (resultFilter === 'success' && log.result !== 'success') return false
        if (resultFilter === 'failure' && log.result !== 'failure') return false
      }

      // Search filter
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        (log.action && log.action.toLowerCase().includes(q)) ||
        (log.entity && log.entity.toLowerCase().includes(q)) ||
        (log.entity_name && log.entity_name.toLowerCase().includes(q)) ||
        (log.reason && log.reason.toLowerCase().includes(q)) ||
        (log.username && log.username.toLowerCase().includes(q)) ||
        (log.user_email && log.user_email.toLowerCase().includes(q)) ||
        (log.ip_address && log.ip_address.includes(q))
      )
    })
  }, [logs, actionFilter, resultFilter, search])

  useEffect(() => setCurrentPage(1), [actionFilter, resultFilter, search, dateFrom, dateTo])
  const pagedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const auditStats = useMemo(() => ({
    total: logs.length,
    visible: filteredLogs.length,
    success: logs.filter(log => log.result !== 'failure').length,
    failures: logs.filter(log => log.result === 'failure').length,
  }), [logs, filteredLogs])

  const getActionBadge = (action, result) => {
    const isFail = result === 'failure'
    if (isFail) {
      return (
        <span className="audit-badge inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border-rose-300 dark:border-rose-700">
          <XCircle size={12} /> {action}
        </span>
      )
    }

    if (action.includes('PRICE')) {
      return (
        <span className="audit-badge inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border-amber-300 dark:border-amber-700">
          <Tag size={12} /> {action}
        </span>
      )
    }

    if (action.includes('INVOICE') || action.includes('PAYMENT')) {
      return (
        <span className="audit-badge inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 border-blue-300 dark:border-blue-700">
          <FileText size={12} /> {action}
        </span>
      )
    }

    if (action.includes('STOCK')) {
      return (
        <span className="audit-badge inline-flex items-center gap-1 text-[11px] font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200 border-teal-300 dark:border-teal-700">
          <Layers size={12} /> {action}
        </span>
      )
    }

    return (
      <span className="audit-badge inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700">
        <CheckCircle2 size={12} /> {action}
      </span>
    )
  }

  const exportCsv = () => {
    if (!filteredLogs.length) return
    const headers = ['Timestamp', 'Action', 'Entity', 'Entity Name', 'User', 'Role', 'Reason', 'IP Address', 'Result']
    const rows = filteredLogs.map(l => [
      l.created_at,
      l.action,
      l.entity || '',
      `"${(l.entity_name || '').replace(/"/g, '""')}"`,
      l.username || 'System',
      l.user_role || '',
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      l.ip_address || '',
      l.result || 'success',
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="audit-trail-page w-full min-w-0 space-y-4 pb-16 text-[var(--ink)]">
      <style>{`
        .audit-trail-page .audit-action {
          transition: transform .15s ease, box-shadow .15s ease, background-color .15s ease;
        }
        .audit-trail-page .audit-action:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(15, 23, 42, .14);
        }
        .audit-trail-page .audit-badge {
          border-width: 1px;
          border-radius: 9999px;
          padding: 4px 8px;
        }
      `}</style>
      {/* Header */}
      <PageHeader
        title="Statutory Audit Trail"
        subtitle="Immutable ERP chronological log tracking who, what, when, where, before, after, reason, and IP address for all operations."
        action={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="audit-action btn-base flex items-center justify-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-900/60"
              title="Refresh audit logs"
            >
              <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              onClick={exportCsv}
              disabled={!filteredLogs.length}
              className="audit-action btn-base flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Export filtered audit logs to CSV"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-xs space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              className="input pl-8 w-full h-9 text-xs"
              placeholder="Search action, reason, user, IP..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-[var(--muted)] shrink-0" />
            <select
              className="input w-full h-9 text-xs"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
            >
              <option value="ALL">All Event Modules</option>
              <option value="INVOICE">Invoices & Payments</option>
              <option value="PRICE">Price Changes</option>
              <option value="STOCK">Stock Adjustments</option>
              <option value="LOGIN">Logins & Auth</option>
              <option value="SETTINGS">Settings Changes</option>
              <option value="USER">User Permissions</option>
              <option value="MASTER">Master Data (Products, Customers, Suppliers)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <select
              className="input h-9 w-full text-xs"
              value={resultFilter}
              onChange={e => setResultFilter(e.target.value)}
              aria-label="Filter audit result"
            >
              <option value="ALL">All Results</option>
              <option value="success">Successful Events</option>
              <option value="failure">Failed Events</option>
            </select>
          </div>

          {/* Date From */}
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-[var(--muted)] shrink-0" />
            <input
              type="date"
              className="input w-full h-9 text-xs"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              placeholder="From Date"
            />
          </div>

          {/* Date To */}
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-[var(--muted)] shrink-0" />
            <input
              type="date"
              className="input w-full h-9 text-xs"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              placeholder="To Date"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line-subtle)] pt-3">
          <p className="text-[11px] text-[var(--muted)]">
            Showing <span className="font-semibold text-[var(--ink)]">{auditStats.visible}</span> of {auditStats.total} events
            <span className="mx-1.5">·</span>
            <span className="text-emerald-700 dark:text-emerald-300">{auditStats.success} successful</span>
            <span className="mx-1.5">·</span>
            <span className="text-rose-700 dark:text-rose-300">{auditStats.failures} failed</span>
          </p>
          {(search || actionFilter !== 'ALL' || resultFilter !== 'ALL' || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={resetFilters}
              className="audit-action inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200 dark:hover:bg-rose-900/60"
            >
              <RotateCcw size={12} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Log Table & Mobile Cards */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-[var(--muted)]">
            <Spinner />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-[var(--muted)]">
            <ShieldCheck size={28} className="mx-auto mb-2 opacity-40 text-[#1E3A5F] dark:text-slate-400" />
            <p className="text-sm font-medium text-[var(--ink)]">No audit events found</p>
            <p className="text-xs text-[var(--muted)]">Try adjusting search filters or date range.</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards (sm:hidden) */}
            <div className="divide-y divide-[var(--line-subtle)] sm:hidden">
              {pagedLogs.map(log => {
                const prevObj = parseJsonSafe(log.previous_value)
                const newObj = parseJsonSafe(log.new_value)

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="p-3.5 space-y-2.5 active:bg-[var(--surface-elevated)] transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {getActionBadge(log.action, log.result)}
                        <span className="block mt-1 text-[11px] font-mono text-[var(--muted)]">
                          {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          }) : '—'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedLog(log)
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-sky-600 px-2.5 text-xs font-medium text-white hover:bg-sky-700"
                      >
                        <Eye size={12} />
                        View
                      </button>
                    </div>

                    <div className="text-xs">
                      <div className="font-semibold text-[var(--ink)]">
                        {log.entity_name || log.entity_id || 'System Entity'}
                      </div>
                      <div className="text-[11px] text-[var(--muted)]">
                        {log.entity || log.module || ''} {log.entity_id ? `(#${log.entity_id})` : ''}
                      </div>
                    </div>

                    {/* Diff Preview */}
                    {log.action === 'PRICE_CHANGED' && prevObj && newObj && (
                      <div className="flex items-center gap-1.5 font-mono text-xs bg-[var(--surface-elevated)] p-2 rounded border border-[var(--line)]">
                        <span className="text-[#B91C1C] line-through">₹{Number(prevObj.selling_price || 0).toFixed(2)}</span>
                        <ArrowRight size={11} className="text-[var(--muted)]" />
                        <span className="text-[#0F766E] font-bold">₹{Number(newObj.selling_price || 0).toFixed(2)}</span>
                      </div>
                    )}

                    {/* Reason */}
                    {log.reason && (
                      <div className="text-[11px] italic text-[#B45309] dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                        "{log.reason}"
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-1 border-t border-[var(--line-subtle)]">
                      <div className="flex items-center gap-1">
                        <User size={12} className="text-[#1E3A5F] dark:text-slate-300" />
                        <span className="font-medium text-[var(--ink)]">{log.username || 'System'}</span>
                        {log.user_role && (
                          <span className="text-[9px] uppercase px-1 rounded bg-[var(--surface-elevated)] text-[var(--muted)] border border-[var(--line)]">
                            {log.user_role}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px]">{log.ip_address || '127.0.0.1'}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table (hidden sm:block) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="erp-table w-full text-left text-xs min-w-[760px]">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--surface-elevated)] font-semibold text-[var(--ink-secondary)]">
                    <th className="py-2.5 px-3">When</th>
                    <th className="py-2.5 px-3">Who</th>
                    <th className="py-2.5 px-3">What (Action)</th>
                    <th className="py-2.5 px-3">Target Entity</th>
                    <th className="py-2.5 px-3">Reason / Justification</th>
                    <th className="py-2.5 px-3">Changes (Diff)</th>
                    <th className="py-2.5 px-3">IP / Device</th>
                    <th className="py-2.5 px-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {pagedLogs.map(log => {
                    const prevObj = parseJsonSafe(log.previous_value)
                    const newObj = parseJsonSafe(log.new_value)

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-[var(--surface-elevated)] transition-colors group cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        {/* When */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-[var(--ink-secondary)] font-mono">
                          {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          }) : '—'}
                        </td>

                        {/* Who */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-[#1E3A5F] dark:text-slate-300 shrink-0" />
                            <div className="min-w-0">
                              <span className="font-semibold text-[var(--ink)]">
                                {log.username || 'System'}
                              </span>
                              {log.user_role && (
                                <span className="ml-1 text-[10px] px-1 py-0.2 rounded bg-[var(--surface-elevated)] text-[var(--muted)] border border-[var(--line)] font-medium uppercase">
                                  {log.user_role}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* What */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {getActionBadge(log.action, log.result)}
                        </td>

                        {/* Target Entity */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-medium text-[var(--ink)]">
                            {log.entity_name || log.entity_id || '—'}
                          </div>
                          <div className="text-[10px] text-[var(--muted)]">
                            {log.entity || log.module || ''} {log.entity_id && log.entity_name ? `(#${log.entity_id})` : ''}
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="py-2.5 px-3 max-w-[200px] truncate text-[var(--ink-secondary)]" title={log.reason || log.failure_reason}>
                          {log.reason ? (
                            <span className="italic text-[11px] text-[#B45309] dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              "{log.reason}"
                            </span>
                          ) : log.failure_reason ? (
                            <span className="text-[#B91C1C] dark:text-red-400 text-[11px]">
                              {log.failure_reason}
                            </span>
                          ) : (
                            <span className="text-[var(--muted)] text-[11px]">Standard operation</span>
                          )}
                        </td>

                        {/* Changes (Diff) */}
                        <td className="py-2.5 px-3 max-w-[220px]">
                          {log.action === 'PRICE_CHANGED' && prevObj && newObj ? (
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="text-[#B91C1C] line-through">
                                ₹{Number(prevObj.selling_price || 0).toFixed(2)}
                              </span>
                              <ArrowRight size={11} className="text-[var(--muted)]" />
                              <span className="text-[#0F766E] font-bold">
                                ₹{Number(newObj.selling_price || 0).toFixed(2)}
                              </span>
                            </div>
                          ) : log.action === 'INVOICE_EDITED' && prevObj && newObj ? (
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="text-[var(--muted)]">
                                Disc: ₹{Number(prevObj.discount_amount || 0).toFixed(0)}
                              </span>
                              <ArrowRight size={11} className="text-[var(--muted)]" />
                              <span className="text-[#1E3A5F] dark:text-slate-100 font-bold">
                                ₹{Number(newObj.discount_amount || 0).toFixed(0)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[var(--muted)] truncate block">
                              {log.new_value ? (typeof newObj === 'object' ? Object.keys(newObj).slice(0, 3).join(', ') : String(log.new_value).slice(0, 30)) : '—'}
                            </span>
                          )}
                        </td>

                        {/* IP / Device */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-[var(--muted)]">
                          <div className="flex items-center gap-1">
                            <Laptop size={12} className="text-[var(--muted)] shrink-0" />
                            <span className="font-mono">{log.ip_address || '127.0.0.1'}</span>
                          </div>
                        </td>

                        {/* Details Button */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-right">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setSelectedLog(log)
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E3A5F] hover:text-[#162F4D] dark:text-slate-300"
                          >
                            <Eye size={12} /> View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <Pagination
                currentPage={currentPage}
                totalPages={Math.max(1, Math.ceil(filteredLogs.length / pageSize))}
                totalItems={filteredLogs.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        )}
      </div>

      {/* Detailed Audit Modal */}
      {selectedLog && (
        <Modal
          open={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Audit Log #${selectedLog.id} — ${selectedLog.action}`}
        >
          <div className="space-y-4 text-xs">
            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)]">
              <div>
                <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Who (Operator)</span>
                <p className="font-medium text-[var(--ink)]">{selectedLog.username || 'System'}</p>
                <p className="text-[11px] text-[var(--muted)]">{selectedLog.user_email || 'No email registered'}</p>
                <p className="text-[10px] text-[var(--muted)] font-semibold uppercase">{selectedLog.user_role || 'Staff'}</p>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">When & Where</span>
                <p className="font-mono text-[var(--ink)]">
                  {selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString('en-IN') : '—'}
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  Entity: <span className="font-semibold text-[var(--ink)]">{selectedLog.entity}</span> ({selectedLog.entity_name || `#${selectedLog.entity_id}`})
                </p>
              </div>

              <div className="sm:col-span-2">
                <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Reason / Justification</span>
                <p className="p-2 rounded bg-[var(--surface)] border border-[var(--line)] font-medium text-[var(--ink)]">
                  {selectedLog.reason || selectedLog.failure_reason || 'Standard system action (no special override justification required).'}
                </p>
              </div>

              <div className="sm:col-span-2">
                <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">IP & Device Client</span>
                <p className="font-mono text-[11px] text-[var(--ink)]">{selectedLog.ip_address || '127.0.0.1'}</p>
                <p className="text-[10px] text-[var(--muted)] truncate" title={selectedLog.user_agent}>
                  User Agent: {selectedLog.user_agent || 'Client browser/API tool'}
                </p>
              </div>
            </div>

            {/* Before vs After Snapshots */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-[#B91C1C] dark:text-red-400">Before State</span>
                  <span className="text-[10px] text-[var(--muted)] font-mono">prior</span>
                </div>
                <pre className="p-2 rounded bg-[var(--surface-elevated)] text-[10px] font-mono overflow-x-auto max-h-48 text-[var(--ink-secondary)]">
                  {selectedLog.previous_value
                    ? JSON.stringify(parseJsonSafe(selectedLog.previous_value), null, 2)
                    : 'None (Initial Creation)'}
                </pre>
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-[#0F766E] dark:text-teal-400">After State</span>
                  <span className="text-[10px] text-[var(--muted)] font-mono">new</span>
                </div>
                <pre className="p-2 rounded bg-[var(--surface-elevated)] text-[10px] font-mono overflow-x-auto max-h-48 text-[var(--ink)]">
                  {selectedLog.new_value
                    ? JSON.stringify(parseJsonSafe(selectedLog.new_value), null, 2)
                    : 'None (Deleted / Cleared)'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="btn-base rounded-lg bg-slate-700 px-4 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
