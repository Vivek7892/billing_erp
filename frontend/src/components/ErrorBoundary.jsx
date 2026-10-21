import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
    }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI Error caught by ErrorBoundary:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false })
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
        <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg,#F5F6F8)] px-4 py-10 text-center text-[var(--ink,#0f172a)]">
          <section className="w-full max-w-sm">
            <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted,#64748b)]">
              We couldn’t load this page. Please try again.
            </p>
            <div className="mt-5 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={this.handleReset}
                className="text-sm font-medium text-[var(--primary,#1E3A5F)] underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary,#1E3A5F)]/30"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="text-sm font-medium text-[var(--primary,#1E3A5F)] underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary,#1E3A5F)]/30"
              >
                Reload page
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
