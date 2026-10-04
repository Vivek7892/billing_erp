import { useState, useEffect } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import {
  MessageCircle,
  Phone,
  Mail,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Copy,
  Clock,
  Send,
} from 'lucide-react'

export default function CommunicationHistory({
  referenceType,
  referenceId,
  initialLogs = null,
  compact = false,
  onLogAdded = null,
}) {
  const [logs, setLogs] = useState(initialLogs || [])
  const [loading, setLoading] = useState(!initialLogs)

  const fetchLogs = async () => {
    if (!referenceType || !referenceId) return
    try {
      const res = await api.get('/communication-logs/', {
        params: {
          reference_type: referenceType,
          reference_id: referenceId,
        },
      })
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setLogs(data)
    } catch {
      // silent fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialLogs) {
      fetchLogs()
    } else {
      setLogs(initialLogs)
    }
  }, [referenceType, referenceId, initialLogs])

  if (loading) {
    return (
      <div className="py-2 text-[11px] text-[var(--muted)]">
        Loading communication history...
      </div>
    )
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="py-2.5 px-3 rounded-md border border-dashed border-[var(--line)] bg-[var(--surface-elevated)]/50 text-[11px] text-[var(--muted)] flex items-center gap-2">
        <MessageCircle size={13} className="text-[var(--muted-light)] shrink-0" />
        <span>No communications sent yet. Use the action buttons above to send via WhatsApp or SMS.</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-[var(--ink-secondary)] uppercase tracking-wider flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <MessageCircle size={13} className="text-emerald-600 dark:text-emerald-400" />
          Communication History ({logs.length})
        </span>
      </div>

      <div className="space-y-2">
        {logs.map(log => {
          const sentDate = log.sent_at ? new Date(log.sent_at) : null
          const formattedDate = sentDate
            ? sentDate.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '—'
          const formattedTime = sentDate
            ? sentDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''

          return (
            <div
              key={log.id}
              className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] space-y-1 text-xs transition-colors hover:border-[var(--line-strong)]"
            >
              {/* Channel and Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                  {log.channel === 'whatsapp' ? (
                    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <MessageCircle size={13} /> WhatsApp
                    </span>
                  ) : log.channel === 'sms' ? (
                    <span className="flex items-center gap-1 text-[#4F46E5] dark:text-[#818CF8]">
                      <Phone size={13} /> SMS
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-purple-700 dark:text-purple-400">
                      <Mail size={13} /> Email
                    </span>
                  )}
                  {log.recipient_phone && (
                    <span className="text-[11px] font-mono font-normal text-[var(--muted)]">
                      ({log.recipient_phone})
                    </span>
                  )}
                </div>

                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold text-emerald-300 bg-emerald-950/40 border border-emerald-800/50">
                  <CheckCircle2 size={11} /> {log.status === 'sent' ? '✓ Sent' : log.status}
                </span>
              </div>

              {/* Timestamp */}
              <div className="text-[11px] text-[var(--muted)] flex items-center gap-1.5 font-medium">
                <Calendar size={11} className="shrink-0" />
                <span>{formattedDate}</span>
                {formattedTime && (
                  <span className="text-[10px] text-[var(--muted)] font-mono">
                    {formattedTime}
                  </span>
                )}
                {log.sent_by_name && (
                  <span className="text-[10px] text-[var(--muted-light)]">
                    • by {log.sent_by_name}
                  </span>
                )}
              </div>

              {/* Short Link */}
              {log.short_url && (
                <div className="pt-0.5 flex items-center gap-1.5">
                  <a
                    href={log.short_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-mono text-[#4F46E5] dark:text-[#818CF8] hover:underline flex items-center gap-1 break-all"
                    title="Open short link"
                  >
                    ({log.short_url})
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(log.short_url)
                      toast.success('Short link copied!')
                    }}
                    className="text-[var(--muted)] hover:text-[var(--ink)] p-0.5 rounded hover:bg-[var(--surface)] transition-colors"
                    title="Copy short link"
                  >
                    <Copy size={11} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
