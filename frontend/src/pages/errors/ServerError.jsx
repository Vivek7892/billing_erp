import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ServerCrash, RefreshCw, Home, LifeBuoy, Copy, Check } from 'lucide-react'

export default function ServerError({ error, onReload }) {
  const [copied, setCopied] = useState(false)
  const [incidentId] = useState(() => `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`)

  const handleCopyId = () => {
    navigator.clipboard?.writeText(incidentId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReload = () => {
    if (typeof onReload === 'function') {
      onReload()
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="flex min-h-[85vh] w-full items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] p-6 text-center shadow-lg sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shadow-xs dark:bg-rose-950/40 dark:text-rose-400">
          <ServerCrash size={32} strokeWidth={1.75} />
        </div>

        <div className="mt-4 inline-flex items-center rounded-full border border-rose-200 bg-rose-50/70 px-3 py-1 text-[11px] font-bold tracking-wider text-rose-700 uppercase dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          Error 500 · Server Error
        </div>

        <h1 className="mt-3 text-xl font-bold tracking-tight text-[var(--ink,#172033)] sm:text-2xl">
          Internal Server Error
        </h1>

        <p className="mt-2 text-xs leading-relaxed text-[var(--muted,#64748B)] sm:text-sm">
          The server encountered an unexpected condition and could not complete your request.
          Our diagnostic systems have logged the incident.
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface-hover,#F1F5F9)] px-3 py-1.5 text-xs">
          <span className="text-[var(--muted,#64748B)]">Incident ID:</span>
          <code className="font-mono font-bold text-[var(--ink,#172033)]">{incidentId}</code>
          <button
            type="button"
            onClick={handleCopyId}
            title="Copy Incident ID"
            aria-label="Copy Incident ID"
            className="ml-1 text-[var(--muted,#64748B)] hover:text-[var(--ink,#172033)]"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          </button>
        </div>

        {error && (
          <div className="mt-4 max-h-32 overflow-auto rounded-lg border border-rose-200/60 bg-rose-50/50 p-2.5 text-left text-[11px] font-mono text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            {error.message || String(error)}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleReload}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#162F4D]"
          >
            <RefreshCw size={15} />
            <span>Reload Page</span>
          </button>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] px-4 py-2.5 text-xs font-semibold text-[var(--ink,#172033)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Home size={15} />
            <span>Go to Dashboard</span>
          </Link>

          <Link
            to="/support"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] px-4 py-2.5 text-xs font-semibold text-[var(--ink,#172033)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LifeBuoy size={15} />
            <span>Support</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

