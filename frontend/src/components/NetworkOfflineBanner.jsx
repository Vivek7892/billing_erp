import { WifiOff, Wifi, RefreshCw } from 'lucide-react'
import { useNetworkStatus } from '../context/NetworkStatusContext'

export default function NetworkOfflineBanner() {
  const { isOnline, wasOffline, isReconnecting, checkConnection } = useNetworkStatus()

  // When fully online and not in transitional "just reconnected" state, render nothing
  if (isOnline && !wasOffline) {
    return null
  }

  // Temporary "Back Online" confirmation banner
  if (isOnline && wasOffline) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all duration-300 animate-in fade-in slide-in-from-top"
      >
        <Wifi size={14} className="shrink-0" />
        <span>Connection restored. You are back online.</span>
      </aside>
    )
  }

  // Active "Offline" persistent banner
  return (
    <aside
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[100] flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/95 px-3.5 py-2 text-xs font-medium text-slate-950 backdrop-blur-sm shadow-md sm:px-6 dark:bg-amber-600/95 dark:text-white"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600"></span>
        </span>
        <WifiOff size={15} className="shrink-0" />
        <span>
          <strong className="font-semibold">No Internet Connection.</strong>{' '}
          <span className="hidden sm:inline">You are working offline. Actions requiring the server will sync when reconnected.</span>
          <span className="sm:hidden">Offline mode.</span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => checkConnection()}
        disabled={isReconnecting}
        className="inline-flex items-center gap-1.5 rounded-md bg-slate-900/15 px-2.5 py-1 text-[11px] font-semibold text-slate-950 transition-colors hover:bg-slate-900/25 active:scale-95 disabled:opacity-50 dark:bg-black/20 dark:text-white dark:hover:bg-black/35"
      >
        <RefreshCw size={12} className={isReconnecting ? 'animate-spin' : ''} />
        <span>{isReconnecting ? 'Checking…' : 'Check Connection'}</span>
      </button>
    </aside>
  )
}

