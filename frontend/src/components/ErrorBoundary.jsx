import React from 'react'
import { IconAlertTriangle, IconRotate2, IconHome, IconRefresh } from '@tabler/icons-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Keep error logged to console for debugging, never expose raw stack to end users
    console.error('Unhandled UI Error caught by ErrorBoundary:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null }, () => {
      window.location.href = '/'
    })
  }

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({
          error: this.state.error,
          resetError: this.handleReset,
        })
      }

      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg,#F5F6F8)] px-4 py-12 text-center text-[var(--ink,#0f172a)] antialiased">
          <section className="w-full max-w-md rounded-2xl border border-[var(--line,#e2e8f0)] bg-[var(--surface,#ffffff)] p-7 sm:p-9 shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <IconAlertTriangle size={28} strokeWidth={2} />
            </div>

            <h1 className="mt-5 text-xl font-bold tracking-tight text-[var(--ink,#0f172a)]">
              Unable to load this page
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted,#64748b)]">
              Something unexpected happened while preparing this screen. Please try again or return to the main dashboard.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#162F4D] active:scale-[0.98] dark:bg-sky-700 dark:hover:bg-sky-600"
              >
                <IconRotate2 size={15} />
                <span>Try again</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="text-[var(--ink,#0f172a)] inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-[var(--line,#e2e8f0)] px-3 text-xs font-medium hover:bg-[var(--surface,#ffffff)] hover:text-[var(--ink,#0f172a)] dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <IconHome size={15} />
                <span>Go to Dashboard</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-medium text-[var(--muted,#64748b)] hover:text-[var(--ink,#0f172a)]"
                title="Reload browser page"
              >
                <IconRefresh size={14} />
                <span>Reload</span>
              </button>
            </div>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
