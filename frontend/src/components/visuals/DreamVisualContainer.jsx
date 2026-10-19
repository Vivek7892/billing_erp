import { useState, useEffect } from 'react'
import './DreamVisualStyles.css'

/**
 * DreamVisualContainer
 * High-performance visual container for Dreamwithtech ERP.
 * 
 * Supports both:
 * 1. User uploaded media (images/GIFs/videos) placed in public/assets/dreamwithtech/<slotKey>.(png|jpg|webp|svg|gif|mp4)
 *    or passed directly via `uploadedSrc`.
 * 2. High-fidelity vector/SVG animations matching official Dreamwithtech brand standards.
 */
export default function DreamVisualContainer({
  slotKey,
  title,
  uploadedSrc,
  className = '',
  aspectRatio = 'auto',
  children,
  badgeText,
  badgeVariant = 'primary',
  overlayText,
  hideBadge = false,
}) {
  const [imgSrc, setImgSrc] = useState(uploadedSrc || null)
  const [imgError, setImgError] = useState(false)
  const [loading, setLoading] = useState(Boolean(uploadedSrc))

  useEffect(() => {
    if (uploadedSrc) {
      setImgSrc(uploadedSrc)
      setImgError(false)
      setLoading(true)
      return
    }

    // Probe common extensions for user-uploaded assets in public directory
    if (slotKey) {
      const candidate = `/assets/dreamwithtech/${slotKey}.png`
      const testImg = new Image()
      testImg.src = candidate
      testImg.onload = () => {
        setImgSrc(candidate)
        setImgError(false)
        setLoading(false)
      }
      testImg.onerror = () => {
        // Try webp
        const testWebp = new Image()
        const candidateWebp = `/assets/dreamwithtech/${slotKey}.webp`
        testWebp.src = candidateWebp
        testWebp.onload = () => {
          setImgSrc(candidateWebp)
          setImgError(false)
          setLoading(false)
        }
        testWebp.onerror = () => {
          setImgSrc(null)
          setImgError(true)
          setLoading(false)
        }
      }
    }
  }, [slotKey, uploadedSrc])

  const hasValidImage = Boolean(imgSrc && !imgError)

  return (
    <div
      className={`dwt-visual-card relative flex flex-col items-center justify-center ${className}`}
      style={aspectRatio !== 'auto' ? { aspectRatio } : undefined}
      role="figure"
      aria-label={title || 'Dreamwithtech Billing ERP Visual'}
    >
      {/* Optional Badge */}
      {!hideBadge && badgeText && (
        <div className="absolute top-3 left-3 z-10">
          <span className={`dwt-badge ${badgeVariant === 'cyan' ? 'dwt-badge-cyan' : badgeVariant === 'success' ? 'dwt-badge-success' : ''}`}>
            {badgeText}
          </span>
        </div>
      )}

      {/* Render uploaded image if present, else render dedicated Dreamwithtech SVG artwork */}
      {hasValidImage ? (
        <img
          src={imgSrc}
          alt={title || 'Dreamwithtech Visual Asset'}
          className={`dwt-visual-img ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onLoad={() => setLoading(false)}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {children}
        </div>
      )}

      {/* Optional Caption Overlay */}
      {overlayText && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-white text-xs font-medium">
          {overlayText}
        </div>
      )}
    </div>
  )
}

