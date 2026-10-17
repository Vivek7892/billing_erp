import { Link } from 'react-router-dom'

export default function AppFooter({ shopName }) {
  const currentYear = new Date().getFullYear()
  const brandName = shopName || 'Dreamwithtech'

  const quickLinks = [
    { label: 'Dashboard', path: '/' },
    { label: 'Billing', path: '/billing/new' },
    { label: 'Reports', path: '/reports' },
    { label: 'Settings', path: '/settings' },
    { label: 'Terms', path: '/terms-and-conditions' },
  ]

  return (
    <footer className="mt-auto border-t border-[var(--line)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">

        {/* Brand */}
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt={`${brandName} logo`}
            className="h-6 w-6 rounded object-contain"
          />

          <span className="text-xs font-semibold text-[var(--text)]">
            {brandName}
          </span>
        </div>

        {/* Links */}
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-center gap-x-3 gap-y-1"
        >
          {quickLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="text-[11px] text-[var(--muted-light)] transition-colors hover:text-[var(--text)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Copyright */}
        <div className="flex items-center gap-3 text-[10px] text-[var(--muted-light)]">
          <span>
            © {currentYear} {brandName}
          </span>

          <span className="hidden sm:inline">·</span>

          <span className="hidden sm:inline">
            Powered by{' '}
            <a
              href="https://dreamwithtech.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--text)] hover:underline"
            >
              Dreamwithtech
            </a>
          </span>
        </div>

      </div>
    </footer>
  )
}
