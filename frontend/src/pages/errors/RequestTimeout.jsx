import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Hourglass, RefreshCw, Home, Wifi } from 'lucide-react'

export default function RequestTimeout({ onRetry }) {
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    if (typeof onRetry === 'function') {
      try {
        await onRetry()
      } finally {
        setIsRetrying(false)
      }
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="flex min-h-[85vh] w-full items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] p-6 text-center shadow-lg sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-xs dark:bg-amber-950/40 dark:text-amber-400">
          <Hourglass size={32} strokeWidth={1.75} />
        </div>

        <div className="mt-4 inline-flex items-center rounded-full border border-amber-200 bg-amber-50/70 px-3 py-1 text-[11px] font-bold tracking-wider text-amber-700 uppercase dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          Request Timeout · 408
        </div>

        <h1 className="mt-3 text-xl font-bold tracking-tight text-[var(--ink,#172033)] sm:text-2xl">
          Request Took Too Long
        </h1>

        <p className="mt-2 text-xs leading-relaxed text-[var(--muted,#64748B)] sm:text-sm">
          The server did not respond within the expected timeframe.
          This can happen during brief network interruptions or heavy server processing.
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface-hover,#F1F5F9)] px-3.5 py-1.5 text-xs text-[var(--ink,#172033)]">
          <Wifi size={14} className="text-amber-600 dark:text-amber-400" />
          <span>Tip: Check your WiFi or mobile connection and try again.</span>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#162F4D] disabled:opacity-50"
          >
            <RefreshCw size={15} className={isRetrying ? 'animate-spin' : ''} />
            <span>{isRetrying ? 'Retrying…' : 'Try Again'}</span>
          </button>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] px-4 py-2.5 text-xs font-semibold text-[var(--ink,#172033)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Home size={15} />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

