import { Link } from 'react-router-dom'
import { IconAlertTriangle, IconHome, IconRefresh } from '@tabler/icons-react'

export default function SimpleErrorPage({
  title = 'Something went wrong',
  message = 'Please try again. If the problem continues, contact support.',
  actionLabel = 'Try again',
  to,
  onAction,
  disabled = false,
}) {
  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-[var(--app-bg)] px-4 py-12 text-center text-[var(--ink)] antialiased">
      <section className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 sm:p-9 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-[#1E3A5F] dark:bg-slate-800 dark:text-sky-300">
          <IconAlertTriangle size={28} strokeWidth={2} />
        </div>

        <h1 className="mt-5 text-xl font-bold tracking-tight text-[var(--ink)]">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {message}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          {to ? (
            <Link
              to={to}
              className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#162F4D] active:scale-[0.98] dark:bg-sky-700 dark:hover:bg-sky-600"
            >
              <IconHome size={15} />
              <span>{actionLabel}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              disabled={disabled}
              className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#162F4D] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 dark:bg-sky-700 dark:hover:bg-sky-600"
            >
              <IconRefresh size={15} />
              <span>{actionLabel}</span>
            </button>
          )}

          <Link
            to="/"
            className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)] active:scale-[0.98]"
          >
            <IconHome size={15} />
            <span>Dashboard</span>
          </Link>
        </div>
      </section>
    </main>
  )
}
