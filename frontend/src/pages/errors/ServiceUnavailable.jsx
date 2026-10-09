import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CloudOff, RefreshCw, Home, Clock } from 'lucide-react'

export default function ServiceUnavailable({ onRetry, code = '503' }) {
  const [countdown, setCountdown] = useState(15)
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    if (typeof onRetry === 'function') {
      try {
        await onRetry()
      } finally {
        setIsRetrying(false)
        setCountdown(15)
      }
    } else {
      window.location.reload()
    }
  }

  useEffect(() => {
    if (countdown <= 0) {
      handleRetry()
      return
    }

    const timer = setInterval(() => {
      setCountdown((c) => c - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [countdown])

  return (
    <div className="flex min-h-[85vh] w-full items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] p-6 text-center shadow-lg sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-xs dark:bg-indigo-950/40 dark:text-indigo-400">
          <CloudOff size={32} strokeWidth={1.75} />
        </div>

        <div className="mt-4 inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50/70 px-3 py-1 text-[11px] font-bold tracking-wider text-indigo-700 uppercase dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300">
          Error {code} · Service Unavailable
        </div>

        <h1 className="mt-3 text-xl font-bold tracking-tight text-[var(--ink,#172033)] sm:text-2xl">
          System Maintenance
        </h1>

        <p className="mt-2 text-xs leading-relaxed text-[var(--muted,#64748B)] sm:text-sm">
          The POS and billing server is temporarily busy, restarting, or undergoing maintenance.
          Service is expected to return momentarily.
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface-hover,#F1F5F9)] px-3.5 py-1.5 text-xs text-[var(--ink,#172033)]">
          <Clock size={14} className="text-indigo-600 dark:text-indigo-400" />
          <span>Auto-retrying in <strong className="font-bold text-indigo-600 dark:text-indigo-400">{countdown}s</strong></span>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#162F4D] disabled:opacity-50"
          >
            <RefreshCw size={15} className={isRetrying ? 'animate-spin' : ''} />
            <span>{isRetrying ? 'Checking Server…' : 'Retry Now'}</span>
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

