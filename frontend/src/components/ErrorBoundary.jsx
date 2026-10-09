import React from 'react'
import { AlertTriangle, RefreshCw, Home, Copy, Check, ChevronDown } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('Unhandled UI Error caught by ErrorBoundary:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false })
  }

  handleGoHome = () => {
    this.handleReset()
    window.location.href = '/'
  }

  handleCopyDetails = () => {
    const { error, errorInfo } = this.state
    const details = [
      `Error: ${error?.message || String(error)}`,
      `Component Stack: ${errorInfo?.componentStack || 'N/A'}`,
      `URL: ${window.location.href}`,
      `Timestamp: ${new Date().toISOString()}`,
      `User Agent: ${navigator.userAgent}`,
    ].join('\n')

    navigator.clipboard?.writeText(details)
    this.setState({ copied: true })
    setTimeout(() => this.setState({ copied: false }), 2000)
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

      const { error, errorInfo, copied } = this.state

      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg,#F8FAFC)] p-4 sm:p-6 text-[var(--ink,#172033)]">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] p-6 text-center shadow-xl sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-xs dark:bg-amber-950/40 dark:text-amber-400">
              <AlertTriangle size={28} strokeWidth={2} />
            </div>

            <div className="mt-4 inline-flex items-center rounded-full border border-amber-200 bg-amber-50/70 px-3 py-1 text-[11px] font-bold tracking-wider text-amber-700 uppercase dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              Application Error
            </div>

            <h1 className="mt-3 text-lg font-bold text-[var(--ink,#172033)] sm:text-xl">
              Something went wrong
            </h1>

            <p className="mt-2 text-xs leading-relaxed text-[var(--muted,#64748B)] sm:text-sm">
              An unexpected error occurred while rendering this view. You can reload the workspace or return to the dashboard safely.
            </p>

            {error?.message && (
              <div className="mt-4 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface-hover,#F1F5F9)] p-3 text-left text-xs font-mono text-[var(--muted,#64748B)]">
                <span className="font-semibold text-rose-600 dark:text-rose-400">Error:</span>{' '}
                {error.message}
              </div>
            )}

            {errorInfo?.componentStack && (
              <details className="mt-3 text-left text-xs">
                <summary className="cursor-pointer font-medium text-[var(--muted,#64748B)] hover:text-[var(--ink,#172033)] flex items-center gap-1 select-none">
                  <span>Technical details</span>
                  <ChevronDown size={14} />
                </summary>
                <pre className="mt-2 max-h-36 overflow-auto rounded-lg border border-[var(--line,#D7DEE7)] bg-slate-900 p-2.5 text-[10px] text-slate-200">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#162F4D]"
              >
                <RefreshCw size={14} />
                <span>Reload</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] px-4 py-2.5 text-xs font-semibold text-[var(--ink,#172033)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Home size={14} />
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={this.handleCopyDetails}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] bg-[var(--surface,#FFFFFF)] px-4 py-2.5 text-xs font-semibold text-[var(--muted,#64748B)] transition-colors hover:text-[var(--ink,#172033)] hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy Info'}</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
