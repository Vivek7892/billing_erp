import { Link, useNavigate } from 'react-router-dom'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[85vh] items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--line,#D7DEE7)] p-6 text-center shadow-md sm:p-8">

        <FileQuestion
          size={40}
          className="mx-auto text-[var(--muted,#64748B)]"
        />

        <h1 className="mt-4 text-3xl font-bold text-[var(--ink,#172033)]">
          404
        </h1>

        <h2 className="mt-2 text-lg font-semibold text-[var(--ink,#172033)]">
          Page Not Found
        </h2>

        <p className="mt-2 text-sm text-[var(--muted,#64748B)]">
          The page doesn't exist or may have been moved.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#162F4D]"
          >
            <Home size={16} />
            Dashboard
          </Link>

          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line,#D7DEE7)] px-4 py-2 text-sm font-medium text-[var(--ink,#172033)] hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>

        <div className="mt-6 border-t border-[var(--line,#D7DEE7)] pt-4">
          <p className="mb-3 text-xs font-semibold uppercase text-[var(--muted,#64748B)]">
            Quick Navigation
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/billing/new" className="text-[var(--ink,#172033)] hover:text-[#1E3A5F]">
              New Sale
            </Link>
            <Link to="/sales/invoices" className="text-[var(--ink,#172033)] hover:text-[#1E3A5F]">
              Invoices
            </Link>
            <Link to="/inventory/products" className="text-[var(--ink,#172033)] hover:text-[#1E3A5F]">
              Products
            </Link>
            <Link to="/parties/customers" className="text-[var(--ink,#172033)] hover:text-[#1E3A5F]">
              Customers
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
