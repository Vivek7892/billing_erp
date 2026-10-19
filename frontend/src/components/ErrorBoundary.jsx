import React from 'react'

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
    console.error('Unhandled UI Error caught by ErrorBoundary:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
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
        <main className="flex min-h-screen flex-col items-center justify-center bg-[#F5F6F8] p-6 text-center text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Something went wrong
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
            </p>

            {this.state.error?.stack && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  View Technical Details
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-100 p-2.5 text-[10px] font-mono leading-snug text-red-700 dark:bg-slate-950 dark:text-red-400">
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="rounded-lg bg-[#0057B8] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#003F8F]"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Reload page
              </button>
            </div>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
