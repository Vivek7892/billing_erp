import { useState, useEffect } from 'react'
import { LogIn, KeyRound, AlertCircle, ArrowRight, X } from 'lucide-react'
import { useAuth } from '../AuthContext'

export default function SessionExpiredModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login, user } = useAuth()

  useEffect(() => {
    const handleSessionExpired = (e) => {
      // Prefill username if known
      if (user?.username) {
        setUsername(user.username)
      }
      setError('')
      setIsOpen(true)
    }

    window.addEventListener('auth:session-expired', handleSessionExpired)
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired)
    }
  }, [user])

  if (!isOpen) return null

  const handleQuickLogin = async (e) => {
    e.preventDefault()
    if (!username || !password) {
      setError('Please enter your username and password')
      return
    }

    setLoading(true)
    setError('')
    try {
      await login(username, password)
      setIsOpen(false)
      setPassword('')
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Invalid credentials'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleRedirectLogin = () => {
    setIsOpen(false)
    const currentPath = window.location.pathname + window.location.search
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <KeyRound size={24} />
          </div>
          <button
            type="button"
            onClick={handleRedirectLogin}
            aria-label="Close"
            className="rounded-lg p-1 text-[var(--muted,#64748B)] hover:bg-slate-100 hover:text-[var(--ink,#172033)] dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <h2 id="session-expired-title" className="mt-4 text-lg font-bold text-[var(--ink,#172033)]">
          Session Expired
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted,#64748B)]">
          Your security session has expired. Sign in again below to continue without losing your current workspace.
        </p>

        {error && (
          <div className="mt-3.5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleQuickLogin} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink-secondary,#475569)]">
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="mt-1 w-full rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface-hover,#F1F5F9)] px-3 py-2 text-xs text-[var(--ink,#172033)] outline-none focus:border-[#1E3A5F] focus:bg-[var(--surface,#FFFFFF)] focus:ring-2 focus:ring-[#1E3A5F]/15 dark:focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink-secondary,#475569)]">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="mt-1 w-full rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface-hover,#F1F5F9)] px-3 py-2 text-xs text-[var(--ink,#172033)] outline-none focus:border-[#1E3A5F] focus:bg-[var(--surface,#FFFFFF)] focus:ring-2 focus:ring-[#1E3A5F]/15 dark:focus:border-blue-500"
            />
          </div>

          <div className="mt-5 flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleRedirectLogin}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--line,#D7DEE7)] px-3.5 py-2 text-xs font-semibold text-[var(--ink,#172033)] hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span>Full Login Page</span>
              <ArrowRight size={13} />
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1E3A5F] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#162F4D] disabled:opacity-50"
            >
              <LogIn size={14} />
              <span>{loading ? 'Signing in…' : 'Re-authenticate'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

