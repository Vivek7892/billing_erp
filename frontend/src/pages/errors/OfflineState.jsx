import { Link } from 'react-router-dom'
import { WifiOff, RefreshCw, Home, ShieldCheck } from 'lucide-react'
import { useNetworkStatus } from '../../context/NetworkStatusContext'

export default function OfflineState({ onRetry }) {
  const { isOnline, isReconnecting, checkConnection } = useNetworkStatus()

  const handleCheck = async () => {
    if (typeof onRetry === 'function') {
      await onRetry()
    } else {
      await checkConnection()
    }
  }

  return (
    <div className="flex min-h-[85vh] w-full items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] p-6 text-center shadow-lg sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 shadow-xs dark:bg-slate-800 dark:text-slate-200">
          <WifiOff size={32} strokeWidth={1.75} />
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-bold tracking-wider text-slate-700 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span>Offline Mode</span>
        </div>

        <h1 className="mt-3 text-xl font-bold tracking-tight text-[var(--ink,#172033)] sm:text-2xl">
          No Internet Connection
        </h1>

        <p className="mt-2 text-xs leading-relaxed text-[var(--muted,#64748B)] sm:text-sm">
          You appear to be disconnected from the internet.
          Please check your Wi-Fi, network cable, or cellular connection.
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3.5 py-1.5 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <ShieldCheck size={14} className="shrink-0" />
          <span>Offline safety active: Cached data and current sale drafts remain preserved.</span>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleCheck}
            disabled={isReconnecting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#162F4D] disabled:opacity-50"
          >
            <RefreshCw size={15} className={isReconnecting ? 'animate-spin' : ''} />
            <span>{isReconnecting ? 'Checking Connection…' : 'Check Connection'}</span>
          </button>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] px-4 py-2.5 text-xs font-semibold text-[var(--ink,#172033)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Home size={15} />
            <span>Dashboard</span>
          </Link>
        </div>

        {isOnline && (
          <p className="mt-4 text-xs font-medium text-emerald-600 animate-pulse dark:text-emerald-400">
            ✓ Internet connection detected. You may resume actions now.
          </p>
        )}
      </div>
    </div>
  )
}

