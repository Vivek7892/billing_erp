import { Link } from 'react-router-dom'

export default function SimpleErrorPage({
  title,
  message,
  actionLabel = 'Go to home',
  to,
  onAction,
  disabled = false,
}) {
  const actionClass = 'text-sm font-medium text-[var(--primary,#1E3A5F)] underline underline-offset-4 decoration-[var(--primary,#1E3A5F)]/40 transition hover:decoration-current focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary,#1E3A5F)]/30 disabled:cursor-wait disabled:opacity-60'

  return (
    <main className="flex min-h-[85vh] items-center justify-center bg-[var(--app-bg)] px-4 py-10 text-center text-[var(--ink)]">
      <section className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{message}</p>
        <div className="mt-5">
          {to ? (
            <Link to={to} className={actionClass}>{actionLabel}</Link>
          ) : (
            <button type="button" onClick={onAction} disabled={disabled} className={actionClass}>
              {actionLabel}
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
