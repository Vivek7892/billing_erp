import { useState, useEffect } from 'react'
import { ArrowRight, Sparkles, ExternalLink, X } from 'lucide-react'
import './VisualContent.css'

export default function CompactPromoBanner({
  id = 'dwt-banner-default',
  tag = 'AD',
  tagVariant = 'blue',
  title = 'Send Instant WhatsApp Invoices & Collect UPI Payments',
  description = 'Automate payment reminders and allow customers to pay via PhonePe, GPay, and Paytm directly.',
  ctaText = 'Learn More',
  ctaLink,
  onCtaClick,
  slotKey,
  assetSrc,
  illustration,
  dismissable = false,
  className = '',
}) {
  const [dismissed, setDismissed] = useState(false)
  const [customImgSrc, setCustomImgSrc] = useState(assetSrc || null)

  // Check if user uploaded a custom banner asset
  useEffect(() => {
    if (!slotKey || assetSrc) return

    const extensions = ['webp', 'png', 'jpg', 'svg']
    let isCancelled = false

    const tryLoad = async () => {
      for (const ext of extensions) {
        if (isCancelled) return
        const testPath = `/assets/dreamwithtech/ads/${slotKey}.${ext}`
        try {
          const img = new Image()
          img.src = testPath
          await new Promise((resolve, reject) => {
            img.onload = () => resolve(true)
            img.onerror = () => reject()
          })
          if (!isCancelled) {
            setCustomImgSrc(testPath)
            return
          }
        } catch {
          // Continue to next extension
        }
      }
    }

    tryLoad()
    return () => {
      isCancelled = true
    }
  }, [slotKey, assetSrc])

  if (dismissed) return null

  const handleCta = e => {
    if (onCtaClick) {
      e.preventDefault()
      onCtaClick()
    } else if (ctaLink) {
      if (ctaLink.startsWith('http')) {
        window.open(ctaLink, '_blank', 'noopener,noreferrer')
      } else {
        window.location.href = ctaLink
      }
    }
  }

  return (
    <aside
      className={`dwt-promo-banner group ${className}`}
      role="complementary"
      aria-label={title}
    >
      <div className="dwt-promo-banner-glow dwt-pulse-glow" aria-hidden="true" />

      {/* Copy / Text Content */}
      <div className="dwt-promo-content">
        <div className="dwt-promo-header-row">
          <span className={`dwt-badge-ad ${tagVariant === 'yellow' ? 'yellow-accent' : ''}`}>
            {tag}
          </span>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            Dreamwithtech Cloud
          </span>
        </div>

        <h3 className="dwt-promo-title">{title}</h3>
        <p className="dwt-promo-desc">{description}</p>
      </div>

      {/* Media or Illustration Slot */}
      <div className="dwt-promo-actions">
        {customImgSrc ? (
          <div className="dwt-promo-media-slot">
            <img
              src={customImgSrc}
              alt={title}
              className="max-h-full max-w-full rounded-xl object-contain shadow-2xs"
            />
          </div>
        ) : illustration ? (
          <div className="dwt-promo-media-slot">{illustration}</div>
        ) : (
          <div className="dwt-promo-media-slot">
            {/* Clean, lightweight default flat vector illustration */}
            <svg
              viewBox="0 0 96 96"
              className="w-20 h-20 drop-shadow-sm"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="12" y="18" width="72" height="60" rx="14" fill="#0057B8" fillOpacity="0.08" />
              <rect x="18" y="24" width="60" height="48" rx="10" fill="#FFFFFF" stroke="#0057B8" strokeWidth="1.5" />
              <rect x="26" y="34" width="28" height="4" rx="2" fill="#003F8F" />
              <rect x="26" y="44" width="44" height="3" rx="1.5" fill="#16A9D8" />
              <rect x="26" y="52" width="22" height="3" rx="1.5" fill="#94A3B8" />
              <circle cx="64" cy="36" r="6" fill="#FFE500" />
              <path d="M62 36L63.5 37.5L66 34.5" stroke="#111111" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        <button
          type="button"
          onClick={handleCta}
          className="dwt-cta-btn"
          aria-label={`${ctaText} for ${title}`}
        >
          <span>{ctaText}</span>
          <ArrowRight size={13} strokeWidth={2.5} />
        </button>

        {dismissable && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
            title="Dismiss ad"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </aside>
  )
}

