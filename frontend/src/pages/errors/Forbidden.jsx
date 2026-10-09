import { useNavigate, Link } from 'react-router-dom'
import { ShieldAlert, Home, ArrowLeft, LogOut } from 'lucide-react'
import { useAuth } from '../../AuthContext'

export default function Forbidden() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleSwitchAccount = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-[85vh] w-full items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] p-6 text-center shadow-lg sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-xs dark:bg-amber-950/40 dark:text-amber-400">
          <ShieldAlert size={32} strokeWidth={1.75} />
        </div>

        <div className="mt-4 inline-flex items-center rounded-full border border-amber-200 bg-amber-50/70 px-3 py-1 text-[11px] font-bold tracking-wider text-amber-700 uppercase dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          Error 403 · Access Denied
        </div>

        <h1 className="mt-3 text-xl font-bold tracking-tight text-[var(--ink,#172033)] sm:text-2xl">
          Restricted Permission
        </h1>

        <p className="mt-2 text-xs leading-relaxed text-[var(--muted,#64748B)] sm:text-sm">
          You don't have permission to access this area or perform this action.
        </p>

        {user && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface-hover,#F1F5F9)] px-3 py-1.5 text-xs text-[var(--ink,#172033)]">
            <span className="text-[var(--muted,#64748B)]">Current Account:</span>
            <span className="font-semibold">{user.username || user.email}</span>
            <span className="rounded bg-[var(--line,#D7DEE7)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--ink-secondary,#475569)]">
              {user.role || 'User'}
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#162F4D]"
          >
            <Home size={15} />
            <span>Go to Dashboard</span>
          </Link>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] px-4 py-2.5 text-xs font-semibold text-[var(--ink,#172033)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={15} />
            <span>Go Back</span>
          </button>

          <button
            type="button"
            onClick={handleSwitchAccount}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] px-4 py-2.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
          >
            <LogOut size={15} />
            <span>Switch Account</span>
          </button>
        </div>

        <p className="mt-6 text-[11px] text-[var(--muted,#64748B)]">
          Need access? Please contact your store administrator or account owner.
        </p>
      </div>
    </div>
  )
}

