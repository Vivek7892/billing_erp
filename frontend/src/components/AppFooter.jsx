import { HeartOff } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AppFooter({ shopName }) {
  const currentYear = new Date().getFullYear()
  const brandName = shopName || 'Dreamwithtech'

  const quickLinks = [
    { label: 'Dashboard', path: '/' },
    { label: 'Billing', path: '/billing' },
    { label: 'Reports', path: '/reports' },
    { label: 'Settings', path: '/settings' },
  ]

  return (
    <footer
      className="border-t border-[var(--line-subtle)] bg-[var(--bg-subtle)] text-[var(--muted-light)]" 
    >
      <div
        className="
          mx-auto
          flex
          min-h-[52px]
          max-w-[1800px]
          items-center
          justify-between
          gap-4
          px-4
          py-2
          sm:px-6
          lg:px-8
        "
      >
        {/* Company Branding */}
        <div className="flex min-w-0 shrink-0 items-center gap-2.5">
          <div
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              overflow-hidden
              rounded-lg
              border
              border-[var(--line-subtle)]
              bg-white
            "
          >
            <img
              src="/logo.png"
              alt={`${brandName} logo`}
              className="h-full w-full object-contain p-1"
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-[var(--text)] sm:text-xs">
              {brandName}
            </p>

            <p className="hidden text-[10px] text-[var(--muted-light)] lg:block">
              Smart billing. Simple business.
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <nav
          aria-label="Quick links"
          className="
            hidden
            items-center
            justify-center
            gap-4
            md:flex
            lg:gap-5
          "
        >
          {quickLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="
                whitespace-nowrap
                text-[11px]
                font-medium
                text-[var(--muted-light)]
                transition-colors
                duration-200
                hover:text-[var(--text)]
              "
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Copyright */}
        <p className="hidden text-center text-[10px] sm:block sm:text-[11px]">
          © {currentYear} {brandName}. All rights reserved.
        </p>

        {/* Powered By */}
        <p className="hidden text-right text-[10px] lg:block lg:text-[11px]">
          Powered by{' '}
          <span className="font-semibold text-[var(--text)]">
          <a href="https://dreamwithtech.dev" target="_blank" rel="noopener noreferrer">Dreamwithtech</a>
          </span>
        </p>
      </div>

      {/* Mobile Quick Links */}
      <div
        className="
          flex
          items-center
          justify-center
          gap-4
          border-t
          border-[var(--line-subtle)]
          px-3
          py-1.5
          md:hidden
        "
      >
        {quickLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className="
              text-[10px]
              font-medium
              text-[var(--muted-light)]
              transition-colors
              duration-200
              hover:text-[var(--text)]
            "
          >
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  )
}