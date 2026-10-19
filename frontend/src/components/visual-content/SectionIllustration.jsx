import './VisualContent.css'

export default function SectionIllustration({
  type = 'billing',
  className = 'w-16 h-16',
}) {
  switch (type) {
    case 'inventory':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`${className} shrink-0`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="8" y="14" width="48" height="42" rx="10" fill="#0057B8" fillOpacity="0.08" stroke="#0057B8" strokeWidth="1.5" />
          <path d="M8 26H56" stroke="#0057B8" strokeWidth="1.2" strokeDasharray="3 3" />
          <rect x="18" y="34" width="12" height="12" rx="3" fill="#16A9D8" fillOpacity="0.6" />
          <rect x="34" y="34" width="12" height="12" rx="3" fill="#FFE500" fillOpacity="0.8" />
          <circle cx="32" cy="14" r="3" fill="#003F8F" />
        </svg>
      )

    case 'analytics':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`${className} shrink-0`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="8" y="10" width="48" height="46" rx="10" fill="#F5F6F8" stroke="#E2E8F0" strokeWidth="1.5" />
          <rect x="16" y="36" width="6" height="12" rx="2" fill="#0057B8" fillOpacity="0.3" />
          <rect x="26" y="28" width="6" height="20" rx="2" fill="#16A9D8" fillOpacity="0.7" />
          <rect x="36" y="20" width="6" height="28" rx="2" fill="#0057B8" />
          <circle cx="48" cy="18" r="4" fill="#FFE500" />
        </svg>
      )

    case 'payments':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`${className} shrink-0`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="10" y="16" width="44" height="32" rx="8" fill="#FFFFFF" stroke="#0057B8" strokeWidth="1.5" />
          <rect x="10" y="24" width="44" height="6" fill="#003F8F" />
          <rect x="16" y="36" width="10" height="4" rx="1.5" fill="#16A9D8" />
          <circle cx="46" cy="38" r="4" fill="#FFE500" />
        </svg>
      )

    case 'customers':
      return (
        <svg
          viewBox="0 0 64 64"
          className={`${className} shrink-0`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="32" cy="22" r="10" fill="#0057B8" fillOpacity="0.12" stroke="#0057B8" strokeWidth="1.5" />
          <path d="M16 48C16 39.1634 23.1634 36 32 36C40.8366 36 48 39.1634 48 48" stroke="#003F8F" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="44" cy="24" r="3" fill="#FFE500" />
        </svg>
      )

    case 'billing':
    default:
      return (
        <svg
          viewBox="0 0 64 64"
          className={`${className} shrink-0`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="14" y="10" width="36" height="44" rx="8" fill="#FFFFFF" stroke="#0057B8" strokeWidth="1.5" />
          <path d="M22 20H42" stroke="#003F8F" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M22 28H36" stroke="#16A9D8" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M22 36H30" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="40" cy="38" r="4" fill="#FFE500" />
          <path d="M38.5 38L39.5 39L41.5 37" stroke="#111111" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

