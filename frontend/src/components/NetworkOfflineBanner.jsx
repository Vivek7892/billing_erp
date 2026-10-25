import {
  IconWifiOff,
  IconWifi,
  IconRefresh,
} from '@tabler/icons-react'
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
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 border-b border-emerald-600/30 bg-emerald-600 px-3.5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-xs font-semibold text-white shadow-md backdrop-blur-sm transition-all duration-300 animate-in fade-in slide-in-from-top"
      >
        <IconWifi size={14} className="shrink-0" />
        <span className="truncate">Connection restored • Back online</span>
      </aside>
    )
  }

  // Active "Offline" persistent banner (Ultra mobile-friendly single-line bar)
  return (
    <aside
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between gap-2.5 border-b border-amber-600/40 bg-amber-500 text-slate-950 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 shadow-md backdrop-blur-md sm:px-6 dark:bg-amber-600 dark:text-white"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75"></span>
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600"></span>
        </span>

        <IconWifiOff size={15} className="shrink-0 text-slate-950 dark:text-white" />

        <div className="min-w-0 text-xs">
          {/* Mobile view text */}
          <div className="sm:hidden truncate">
            <span className="font-bold">Offline</span>
            <span className="mx-1 opacity-70">•</span>
            <span className="text-[11px] opacity-90"> Please check your network connection and try again.</span>
          </div>

          {/* Desktop/Tablet view text */}
          <div className="hidden sm:block truncate">
            <strong className="font-bold">No Internet Connection.</strong>{' '}
            <span className="opacity-95 text-[11px]">You are working offline. Actions will sync when reconnected.</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => checkConnection()}
        disabled={isReconnecting}
        className="inline-flex min-h-[30px] shrink-0 items-center gap-1.5 rounded-lg bg-slate-950/15 px-2.5 py-1 text-xs font-bold text-slate-950 transition active:scale-95 disabled:opacity-50 hover:bg-slate-950/25 dark:bg-white/20 dark:text-white dark:hover:bg-white/30"
        title="Check internet connection"
      >
        <IconRefresh size={12} className={isReconnecting ? 'animate-spin' : ''} />
        <span className="sm:hidden">{isReconnecting ? 'Checking' : 'Retry'}</span>
        <span className="hidden sm:inline">{isReconnecting ? 'Checking…' : 'Check Connection'}</span>
      </button>
    </aside>
  )
}
