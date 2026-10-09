import { useLocation, Link } from 'react-router-dom'
import { KeyRound, LogIn, ShieldCheck } from 'lucide-react'

export default function SessionExpired() {
  const location = useLocation()
  const redirectTarget = location.state?.from || location.pathname || '/'

  const loginUrl = `/login?redirect=${encodeURIComponent(redirectTarget)}`

  return (
    <div className="flex min-h-[85vh] w-full items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] p-6 text-center shadow-lg sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-xs dark:bg-amber-950/40 dark:text-amber-400">
          <KeyRound size={32} strokeWidth={1.75} />
        </div>

        <div className="mt-4 inline-flex items-center rounded-full border border-amber-200 bg-amber-50/70 px-3 py-1 text-[11px] font-bold tracking-wider text-amber-700 uppercase dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          Error 401 · Unauthorized
        </div>

        <h1 className="mt-3 text-xl font-bold tracking-tight text-[var(--ink,#172033)] sm:text-2xl">
          Session Expired
        </h1>

        <p className="mt-2 text-xs leading-relaxed text-[var(--muted,#64748B)] sm:text-sm">
          Your security session has expired. To protect store transactions and sensitive billing records, please sign in again to continue.
        </p>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <ShieldCheck size={14} />
          <span>Local bills and drafts are securely cached.</span>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            to={loginUrl}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#162F4D]"
          >
            <LogIn size={15} />
            <span>Sign In Again</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

