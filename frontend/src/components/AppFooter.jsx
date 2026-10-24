import { Link } from 'react-router-dom'

export default function AppFooter({ shopName }) {
  const currentYear = new Date().getFullYear()
  const brandName = shopName || 'Dreamwithtech'

  const quickLinks = [
    { label: 'Terms & Conditions', path: '/terms-and-conditions' },
    { label: 'Support', path: '/support' },
  ]

  return (
    <footer className="mt-auto border-t border-[var(--line)] bg-[var(--surface)] pb-18 md:pb-3">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt={`${brandName} logo`}
            className="h-5 w-5 sm:h-6 sm:w-6 rounded object-contain"
          />
          <span className="text-xs font-semibold text-[var(--text)]">
            {brandName}
          </span>
          <span className="text-[11px] text-[var(--muted-light)]">ERP</span>
        </div>

        {/* Links & Copyright */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-x-4 gap-y-1 text-[11px] text-[var(--muted-light)]">
          <nav aria-label="Footer navigation" className="flex items-center gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="transition-colors hover:text-[var(--text)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <span className="hidden sm:inline">·</span>

          <span>
            © {currentYear} {brandName}
          </span>
        </div>
      </div>
    </footer>
  )
}
